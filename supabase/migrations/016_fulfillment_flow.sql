-- 016_fulfillment_flow.sql
-- Fluxo operacional: pedido -> reserva -> picking -> conferência -> packing -> expedição.

create table if not exists public.fulfillment_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  order_number text not null,
  status text not null default 'open'
    check (status in ('open','reserved','picking','checking','packed','shipped','cancelled')),
  priority integer not null default 2 check (priority between 1 and 5),
  shipping_method text,
  tracking_code text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shipped_at timestamptz,
  unique(company_id, order_number)
);

create table if not exists public.fulfillment_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.fulfillment_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  reserved_quantity numeric(12,3) not null default 0 check (reserved_quantity >= 0),
  picked_quantity numeric(12,3) not null default 0 check (picked_quantity >= 0),
  checked_quantity numeric(12,3) not null default 0 check (checked_quantity >= 0),
  packed_quantity numeric(12,3) not null default 0 check (packed_quantity >= 0),
  status text not null default 'pending'
    check (status in ('pending','reserved','picking','checked','packed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fulfillment_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.fulfillment_orders(id) on delete cascade,
  order_item_id uuid not null references public.fulfillment_order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','released','picked')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.fulfillment_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.fulfillment_orders(id) on delete cascade,
  package_number text not null,
  status text not null default 'open' check (status in ('open','sealed','shipped')),
  weight numeric(12,3),
  width numeric(12,2),
  height numeric(12,2),
  depth numeric(12,2),
  carrier text,
  label_url text,
  created_at timestamptz not null default now(),
  sealed_at timestamptz,
  unique(company_id, package_number)
);

create index if not exists fulfillment_orders_queue_idx on public.fulfillment_orders(company_id, warehouse_id, status, priority, created_at);
create index if not exists fulfillment_items_order_idx on public.fulfillment_order_items(order_id, status);
create index if not exists fulfillment_reservations_product_idx on public.fulfillment_reservations(company_id, warehouse_id, product_id, status);
create index if not exists fulfillment_packages_order_idx on public.fulfillment_packages(order_id, status);

alter table public.fulfillment_orders enable row level security;
alter table public.fulfillment_order_items enable row level security;
alter table public.fulfillment_reservations enable row level security;
alter table public.fulfillment_packages enable row level security;

create policy "fulfillment orders company" on public.fulfillment_orders for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());
create policy "fulfillment items company" on public.fulfillment_order_items for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());
create policy "fulfillment reservations company" on public.fulfillment_reservations for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());
create policy "fulfillment packages company" on public.fulfillment_packages for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

create or replace function public.create_fulfillment_order(
  p_warehouse_id uuid,
  p_order_number text,
  p_customer_id uuid default null,
  p_priority integer default 2,
  p_shipping_method text default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and company_id=v_company_id and active) then raise exception 'Depósito não encontrado'; end if;
  if nullif(trim(p_order_number),'') is null then raise exception 'Número do pedido obrigatório'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'O pedido precisa ter itens'; end if;

  insert into public.fulfillment_orders(company_id,warehouse_id,customer_id,order_number,priority,shipping_method,notes,created_by)
  values(v_company_id,p_warehouse_id,p_customer_id,trim(p_order_number),greatest(1,least(5,p_priority)),nullif(trim(p_shipping_method),''),nullif(trim(p_notes),''),auth.uid())
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantidade inválida'; end if;
    if not exists(select 1 from public.products where id=v_product_id and company_id=v_company_id and active) then raise exception 'Produto não encontrado'; end if;
    insert into public.fulfillment_order_items(company_id,order_id,product_id,quantity)
    values(v_company_id,v_order_id,v_product_id,v_qty);
  end loop;
  return v_order_id;
end;
$$;

create or replace function public.reserve_fulfillment_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_order public.fulfillment_orders%rowtype;
  v_item public.fulfillment_order_items%rowtype;
  v_stock public.warehouse_stock%rowtype;
  v_reserved numeric;
  v_needed numeric;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  select * into v_order from public.fulfillment_orders where id=p_order_id and company_id=v_company_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status not in ('open','reserved') then raise exception 'Pedido não está disponível para reserva'; end if;

  for v_item in select * from public.fulfillment_order_items where order_id=p_order_id and status <> 'cancelled' for update loop
    select coalesce(sum(quantity),0) into v_reserved from public.fulfillment_reservations
    where order_item_id=v_item.id and status='active';
    v_needed := v_item.quantity-v_reserved;
    if v_needed <= 0 then
      update public.fulfillment_order_items set status='reserved',reserved_quantity=v_item.quantity where id=v_item.id;
      continue;
    end if;
    select * into v_stock from public.warehouse_stock
    where company_id=v_company_id and warehouse_id=v_order.warehouse_id and product_id=v_item.product_id for update;
    if not found or v_stock.quantity < v_needed then
      raise exception 'Estoque insuficiente para reservar o item %', v_item.id;
    end if;
    insert into public.fulfillment_reservations(company_id,order_id,order_item_id,product_id,warehouse_id,quantity)
    values(v_company_id,p_order_id,v_item.id,v_item.product_id,v_order.warehouse_id,v_needed);
    update public.fulfillment_order_items set status='reserved',reserved_quantity=v_item.quantity where id=v_item.id;
  end loop;

  update public.fulfillment_orders set status='reserved',updated_at=now() where id=p_order_id;
  perform public.log_audit('reserve','fulfillment_order',p_order_id,jsonb_build_object('status','reserved'));
  return jsonb_build_object('order_id',p_order_id,'status','reserved');
end;
$$;

create or replace function public.advance_fulfillment_order(p_order_id uuid,p_action text,p_tracking_code text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_order public.fulfillment_orders%rowtype;
  v_target text;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  select * into v_order from public.fulfillment_orders where id=p_order_id and company_id=v_company_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  v_target := case p_action
    when 'start_picking' then 'picking'
    when 'start_checking' then 'checking'
    when 'pack' then 'packed'
    when 'ship' then 'shipped'
    else null end;
  if v_target is null then raise exception 'Ação de fulfillment inválida'; end if;

  if p_action='start_picking' and v_order.status <> 'reserved' then raise exception 'Reserve o pedido antes do picking'; end if;
  if p_action='start_checking' and v_order.status <> 'picking' then raise exception 'Pedido precisa estar em picking'; end if;
  if p_action='pack' and v_order.status <> 'checking' then raise exception 'Pedido precisa passar pela conferência'; end if;
  if p_action='ship' and v_order.status <> 'packed' then raise exception 'Pedido precisa estar embalado'; end if;

  update public.fulfillment_orders
  set status=v_target,tracking_code=case when p_action='ship' then nullif(trim(p_tracking_code),'') else tracking_code end,
      shipped_at=case when p_action='ship' then now() else shipped_at end,updated_at=now()
  where id=p_order_id;
  perform public.log_audit('fulfillment','fulfillment_order',p_order_id,jsonb_build_object('action',p_action,'status',v_target));
  return jsonb_build_object('order_id',p_order_id,'status',v_target);
end;
$$;

revoke all on function public.create_fulfillment_order(uuid,text,uuid,integer,text,text,jsonb) from public;
revoke all on function public.reserve_fulfillment_order(uuid) from public;
revoke all on function public.advance_fulfillment_order(uuid,text,text) from public;
grant execute on function public.create_fulfillment_order(uuid,text,uuid,integer,text,text,jsonb) to authenticated;
grant execute on function public.reserve_fulfillment_order(uuid) to authenticated;
grant execute on function public.advance_fulfillment_order(uuid,text,text) to authenticated;
