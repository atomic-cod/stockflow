-- StockFlow 012: bind purchases/sales to their warehouse and make reversals location-aware.
-- This prevents a cancellation from incorrectly adding/removing stock in the
-- current primary warehouse after an internal transfer.

alter table public.purchases
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete restrict;

alter table public.sales
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete restrict;

create index if not exists purchases_warehouse_idx
  on public.purchases(company_id, warehouse_id);

create index if not exists sales_warehouse_idx
  on public.sales(company_id, warehouse_id);

-- Backfill historical operations to the oldest active warehouse.
update public.purchases p
set warehouse_id = (
  select w.id
  from public.warehouses w
  where w.company_id = p.company_id and w.active = true
  order by w.created_at asc
  limit 1
)
where p.warehouse_id is null;

update public.sales s
set warehouse_id = (
  select w.id
  from public.warehouses w
  where w.company_id = s.company_id and w.active = true
  order by w.created_at asc
  limit 1
)
where s.warehouse_id is null;

create or replace function public.apply_stock_movement_at_warehouse(
  p_product_id uuid,
  p_warehouse_id uuid,
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
  v_warehouse_previous numeric(12,3);
  v_warehouse_new numeric(12,3);
  v_movement public.stock_movements;
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
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

  if not exists (
    select 1 from public.warehouses
    where id = p_warehouse_id
      and company_id = v_company_id
      and active = true
  ) then
    raise exception 'Depósito não encontrado ou inativo';
  end if;

  if p_type in ('purchase','return','adjustment_in') then
    v_delta := p_quantity;
  elsif p_type in ('sale','loss','damage','adjustment_out') then
    v_delta := -p_quantity;
  else
    raise exception 'Tipo de movimentação inválido para operação de depósito';
  end if;

  v_previous := v_product.stock_quantity;
  v_new := v_previous + v_delta;

  if v_new < 0 then
    raise exception 'Estoque global insuficiente para o produto: %', v_product.name;
  end if;

  select quantity
  into v_warehouse_previous
  from public.warehouse_stock
  where company_id = v_company_id
    and warehouse_id = p_warehouse_id
    and product_id = p_product_id
  for update;

  v_warehouse_previous := coalesce(v_warehouse_previous, 0);
  v_warehouse_new := v_warehouse_previous + v_delta;

  if v_warehouse_new < 0 then
    raise exception 'Estoque insuficiente no depósito da operação para o produto: %', v_product.name;
  end if;

  update public.products
  set stock_quantity = v_new, updated_at = now()
  where id = p_product_id;

  insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
  values(v_company_id, p_warehouse_id, p_product_id, v_warehouse_new)
  on conflict (company_id, warehouse_id, product_id)
  do update set quantity = excluded.quantity, updated_at = now();

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

revoke all on function public.apply_stock_movement_at_warehouse(uuid,uuid,text,numeric,text,uuid) from public;
grant execute on function public.apply_stock_movement_at_warehouse(uuid,uuid,text,numeric,text,uuid) to authenticated;

-- New purchases and sales are explicitly bound to the primary warehouse.
create or replace function public.create_purchase(
  p_supplier_id uuid default null,
  p_invoice_number text default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_purchase_id uuid;
  v_warehouse_id uuid := public.get_primary_warehouse();
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_total numeric := 0;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if v_warehouse_id is null then raise exception 'Nenhum depósito ativo disponível para a empresa'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'A compra precisa ter pelo menos um item'; end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = p_supplier_id and company_id = v_company_id
  ) then raise exception 'Fornecedor não encontrado'; end if;

  insert into public.purchases(
    company_id,supplier_id,invoice_number,total,status,notes,created_by,warehouse_id
  )
  values(
    v_company_id,p_supplier_id,nullif(trim(p_invoice_number),''),0,'received',
    nullif(trim(p_notes),''),auth.uid(),v_warehouse_id
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := coalesce(nullif(v_item->>'unit_cost','')::numeric,0);

    if v_quantity is null or v_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
    if v_unit_cost < 0 then raise exception 'Custo inválido'; end if;

    if not exists (
      select 1 from public.products
      where id = v_product_id and company_id = v_company_id and active = true
    ) then raise exception 'Produto não encontrado'; end if;

    insert into public.purchase_items(purchase_id,product_id,quantity,unit_cost)
    values(v_purchase_id,v_product_id,v_quantity,v_unit_cost);

    v_total := v_total + (v_quantity * v_unit_cost);

    perform public.apply_stock_movement_at_warehouse(
      v_product_id,v_warehouse_id,'purchase',v_quantity,'Compra',v_purchase_id
    );
  end loop;

  update public.purchases set total = v_total where id = v_purchase_id;
  return v_purchase_id;
end;
$$;

revoke all on function public.create_purchase(uuid,text,text,jsonb) from public;
grant execute on function public.create_purchase(uuid,text,text,jsonb) to authenticated;

create or replace function public.create_sale(
  p_customer_id uuid default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_sale_id uuid;
  v_warehouse_id uuid := public.get_primary_warehouse();
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_total numeric := 0;
  v_product public.products%rowtype;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if v_warehouse_id is null then raise exception 'Nenhum depósito ativo disponível para a empresa'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'A venda precisa ter pelo menos um item'; end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and company_id = v_company_id
  ) then raise exception 'Cliente não encontrado'; end if;

  insert into public.sales(company_id,customer_id,total,status,notes,created_by,warehouse_id)
  values(v_company_id,p_customer_id,0,'completed',nullif(trim(p_notes),''),auth.uid(),v_warehouse_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    select * into v_product
    from public.products
    where id = v_product_id and company_id = v_company_id and active = true
    for update;

    if not found then raise exception 'Produto não encontrado'; end if;
    if v_quantity is null or v_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
    v_unit_price := v_product.sale_price;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Estoque insuficiente para o produto: %', v_product.name;
    end if;

    insert into public.sale_items(sale_id,product_id,quantity,unit_price)
    values(v_sale_id,v_product_id,v_quantity,v_unit_price);

    v_total := v_total + (v_quantity * v_unit_price);

    perform public.apply_stock_movement_at_warehouse(
      v_product_id,v_warehouse_id,'sale',v_quantity,'Venda',v_sale_id
    );
  end loop;

  update public.sales set total = v_total where id = v_sale_id;
  return v_sale_id;
end;
$$;

revoke all on function public.create_sale(uuid,text,jsonb) from public;
grant execute on function public.create_sale(uuid,text,jsonb) to authenticated;

-- Cancellation is location-aware and therefore can only reverse stock that is
-- still available in the original operation warehouse.
create or replace function public.cancel_purchase(p_purchase_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_status text;
  v_warehouse_id uuid;
  v_item record;
begin
  if auth.uid() is null or not public.has_role(array['admin','manager']) then
    raise exception 'Apenas administradores e gerentes podem cancelar compras';
  end if;

  select status, warehouse_id
  into v_status, v_warehouse_id
  from public.purchases
  where id = p_purchase_id and company_id = v_company_id
  for update;

  if v_status is null then raise exception 'Compra não encontrada'; end if;
  if v_status = 'cancelled' then raise exception 'Compra já cancelada'; end if;
  if v_warehouse_id is null then raise exception 'Compra sem depósito de origem registrado'; end if;

  for v_item in
    select product_id, quantity from public.purchase_items where purchase_id = p_purchase_id
  loop
    perform public.apply_stock_movement_at_warehouse(
      v_item.product_id,v_warehouse_id,'adjustment_out',v_item.quantity,
      'Cancelamento de compra',p_purchase_id
    );
  end loop;

  update public.purchases set status = 'cancelled' where id = p_purchase_id;
  perform public.log_audit('cancel','purchase',p_purchase_id,jsonb_build_object('status','cancelled','warehouse_id',v_warehouse_id));
  return true;
end;
$$;

revoke all on function public.cancel_purchase(uuid) from public;
grant execute on function public.cancel_purchase(uuid) to authenticated;

create or replace function public.cancel_sale(p_sale_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_status text;
  v_warehouse_id uuid;
  v_item record;
begin
  if auth.uid() is null or not public.has_role(array['admin','manager']) then
    raise exception 'Apenas administradores e gerentes podem cancelar vendas';
  end if;

  select status, warehouse_id
  into v_status, v_warehouse_id
  from public.sales
  where id = p_sale_id and company_id = v_company_id
  for update;

  if v_status is null then raise exception 'Venda não encontrada'; end if;
  if v_status = 'cancelled' then raise exception 'Venda já cancelada'; end if;
  if v_warehouse_id is null then raise exception 'Venda sem depósito de origem registrado'; end if;

  for v_item in
    select product_id, quantity from public.sale_items where sale_id = p_sale_id
  loop
    perform public.apply_stock_movement_at_warehouse(
      v_item.product_id,v_warehouse_id,'return',v_item.quantity,
      'Cancelamento de venda',p_sale_id
    );
  end loop;

  update public.sales set status = 'cancelled' where id = p_sale_id;
  perform public.log_audit('cancel','sale',p_sale_id,jsonb_build_object('status','cancelled','warehouse_id',v_warehouse_id));
  return true;
end;
$$;

revoke all on function public.cancel_sale(uuid) from public;
grant execute on function public.cancel_sale(uuid) to authenticated;
