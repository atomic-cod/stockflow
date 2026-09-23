-- StockFlow: keep global stock and warehouse stock synchronized.
--
-- Operational policy for the current UI:
-- purchases, sales, losses, returns and adjustments happen in the
-- company's primary active warehouse. Internal transfers move quantities
-- between warehouses without changing the global product total.
--
-- This keeps products.stock_quantity equal to SUM(warehouse_stock.quantity)
-- while the UI does not yet require selecting a warehouse on every
-- purchase/sale operation.

create or replace function public.apply_stock_movement_with_reference(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text default null,
  p_reference_id uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_previous numeric(12,3);
  v_new numeric(12,3);
  v_delta numeric(12,3);
  v_movement public.stock_movements;
  v_company_id uuid;
  v_primary_warehouse_id uuid;
  v_warehouse_previous numeric(12,3);
  v_warehouse_new numeric(12,3);
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  if p_type in ('transfer_in','transfer_out') then
    raise exception 'Transferências devem usar a função transfer_stock';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and company_id = public.get_user_company_id()
  for update;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_company_id := v_product.company_id;

  if p_type in ('purchase','return','adjustment_in') then
    v_delta := p_quantity;
  elsif p_type in ('sale','loss','damage','adjustment_out') then
    v_delta := -p_quantity;
  else
    raise exception 'Tipo de movimentação inválido';
  end if;

  v_previous := v_product.stock_quantity;
  v_new := v_previous + v_delta;

  if v_new < 0 then
    raise exception 'Estoque insuficiente para o produto: %', v_product.name;
  end if;

  v_primary_warehouse_id := public.get_primary_warehouse();

  if v_primary_warehouse_id is null then
    raise exception 'Nenhum depósito ativo disponível para a empresa';
  end if;

  select quantity
  into v_warehouse_previous
  from public.warehouse_stock
  where company_id = v_company_id
    and warehouse_id = v_primary_warehouse_id
    and product_id = p_product_id
  for update;

  v_warehouse_previous := coalesce(v_warehouse_previous, 0);
  v_warehouse_new := v_warehouse_previous + v_delta;

  if v_warehouse_new < 0 then
    raise exception 'Estoque insuficiente no depósito principal para o produto: %', v_product.name;
  end if;

  update public.products
  set stock_quantity = v_new,
      updated_at = now()
  where id = p_product_id;

  insert into public.warehouse_stock(
    company_id, warehouse_id, product_id, quantity
  )
  values(
    v_company_id,
    v_primary_warehouse_id,
    p_product_id,
    v_warehouse_new
  )
  on conflict (company_id, warehouse_id, product_id)
  do update set
    quantity = excluded.quantity,
    updated_at = now();

  insert into public.stock_movements(
    company_id, product_id, type, quantity,
    previous_quantity, new_quantity, reason, reference_id, user_id
  )
  values(
    v_company_id, p_product_id, p_type, p_quantity,
    v_previous, v_new, p_reason, p_reference_id, auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.apply_stock_movement_with_reference(uuid,text,numeric,text,uuid) from public;
grant execute on function public.apply_stock_movement_with_reference(uuid,text,numeric,text,uuid) to authenticated;

-- Reconcile legacy rows once. The primary warehouse is the canonical
-- destination for any global stock that was created before warehouse stock.
insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
select
  p.company_id,
  (select w.id from public.warehouses w where w.company_id = p.company_id and w.active = true order by w.created_at asc limit 1),
  p.id,
  p.stock_quantity
from public.products p
where p.stock_quantity > 0
  and (select w.id from public.warehouses w where w.company_id = p.company_id and w.active = true order by w.created_at asc limit 1) is not null
on conflict (company_id, warehouse_id, product_id)
do update set
  quantity = greatest(public.warehouse_stock.quantity, excluded.quantity),
  updated_at = now();

-- Keep an auditable consistency check available to authenticated users.
create or replace function public.get_stock_consistency()
returns table(
  product_id uuid,
  product_name text,
  global_quantity numeric,
  warehouse_quantity numeric,
  difference numeric
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.stock_quantity,
    coalesce(sum(ws.quantity), 0) as warehouse_quantity,
    p.stock_quantity - coalesce(sum(ws.quantity), 0) as difference
  from public.products p
  left join public.warehouse_stock ws
    on ws.product_id = p.id
   and ws.company_id = p.company_id
  where p.company_id = public.get_user_company_id()
    and p.active = true
  group by p.id, p.name, p.stock_quantity
  order by abs(p.stock_quantity - coalesce(sum(ws.quantity), 0)) desc, p.name asc;
$$;

revoke all on function public.get_stock_consistency() from public;
grant execute on function public.get_stock_consistency() to authenticated;
