-- StockFlow: estoque por depósito e transferências internas

create table if not exists public.warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, warehouse_id, product_id)
);

alter table public.warehouse_stock enable row level security;

create policy "company members view warehouse stock"
on public.warehouse_stock for select to authenticated
using (company_id = public.get_user_company_id());

create index if not exists warehouse_stock_company_idx
  on public.warehouse_stock(company_id, warehouse_id, product_id);

create index if not exists warehouse_stock_product_idx
  on public.warehouse_stock(company_id, product_id);

-- Create a primary warehouse for companies that do not have one yet.
insert into public.warehouses(company_id, name, code, address, active)
select c.id, 'Depósito Principal', 'PRINCIPAL', null, true
from public.companies c
where not exists (
  select 1 from public.warehouses w
  where w.company_id = c.id
);

-- Seed existing global stock into the oldest active warehouse.
insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
select p.company_id, w.id, p.id, p.stock_quantity
from public.products p
join lateral (
  select id
  from public.warehouses
  where company_id = p.company_id and active = true
  order by created_at asc
  limit 1
) w on true
where p.stock_quantity > 0
on conflict (company_id, warehouse_id, product_id)
do update set quantity = excluded.quantity, updated_at = now();

create or replace function public.get_primary_warehouse()
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select w.id
  from public.warehouses w
  where w.company_id = public.get_user_company_id()
    and w.active = true
  order by w.created_at asc
  limit 1;
$$;

revoke all on function public.get_primary_warehouse() from public;
grant execute on function public.get_primary_warehouse() to authenticated;

create or replace function public.transfer_stock(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_from_qty numeric(12,3);
  v_product public.products%rowtype;
  v_transfer_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Não autenticado';
  end if;

  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Os depósitos de origem e destino devem ser diferentes';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = p_from_warehouse_id and company_id = v_company_id and active = true
  ) then
    raise exception 'Depósito de origem não encontrado ou inativo';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = p_to_warehouse_id and company_id = v_company_id and active = true
  ) then
    raise exception 'Depósito de destino não encontrado ou inativo';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and company_id = v_company_id and active = true
  for update;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  select quantity into v_from_qty
  from public.warehouse_stock
  where company_id = v_company_id
    and warehouse_id = p_from_warehouse_id
    and product_id = p_product_id
  for update;

  v_from_qty := coalesce(v_from_qty, 0);

  if v_from_qty < p_quantity then
    raise exception 'Estoque insuficiente no depósito de origem para o produto: %', v_product.name;
  end if;

  insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
  values(v_company_id, p_from_warehouse_id, p_product_id, v_from_qty - p_quantity)
  on conflict (company_id, warehouse_id, product_id)
  do update set quantity = excluded.quantity, updated_at = now();

  insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
  values(v_company_id, p_to_warehouse_id, p_product_id, p_quantity)
  on conflict (company_id, warehouse_id, product_id)
  do update set quantity = public.warehouse_stock.quantity + excluded.quantity, updated_at = now();

  insert into public.stock_movements(
    company_id, product_id, type, quantity,
    previous_quantity, new_quantity, reason, reference_id, user_id
  )
  values (
    v_company_id, p_product_id, 'transfer_out', p_quantity,
    v_product.stock_quantity, v_product.stock_quantity,
    coalesce(nullif(trim(p_notes), ''), 'Transferência entre depósitos'),
    v_transfer_id, auth.uid()
  );

  insert into public.stock_movements(
    company_id, product_id, type, quantity,
    previous_quantity, new_quantity, reason, reference_id, user_id
  )
  values (
    v_company_id, p_product_id, 'transfer_in', p_quantity,
    v_product.stock_quantity, v_product.stock_quantity,
    coalesce(nullif(trim(p_notes), ''), 'Transferência entre depósitos'),
    v_transfer_id, auth.uid()
  );

  perform public.log_audit(
    'transfer',
    'product',
    p_product_id,
    jsonb_build_object(
      'from_warehouse_id', p_from_warehouse_id,
      'to_warehouse_id', p_to_warehouse_id,
      'quantity', p_quantity,
      'notes', p_notes
    )
  );

  return jsonb_build_object(
    'transfer_id', v_transfer_id,
    'product_id', p_product_id,
    'from_warehouse_id', p_from_warehouse_id,
    'to_warehouse_id', p_to_warehouse_id,
    'quantity', p_quantity
  );
end;
$$;

revoke all on function public.transfer_stock(uuid,uuid,uuid,numeric,text) from public;
grant execute on function public.transfer_stock(uuid,uuid,uuid,numeric,text) to authenticated;

create or replace function public.get_product_warehouse_stock(p_product_id uuid)
returns table(
  warehouse_id uuid,
  warehouse_name text,
  warehouse_code text,
  quantity numeric
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select w.id, w.name, w.code, coalesce(ws.quantity, 0)
  from public.warehouses w
  left join public.warehouse_stock ws
    on ws.warehouse_id = w.id
   and ws.product_id = p_product_id
   and ws.company_id = public.get_user_company_id()
  where w.company_id = public.get_user_company_id()
    and w.active = true
  order by w.created_at asc;
$$;

revoke all on function public.get_product_warehouse_stock(uuid) from public;
grant execute on function public.get_product_warehouse_stock(uuid) to authenticated;
