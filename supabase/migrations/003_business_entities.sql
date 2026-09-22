alter table public.stock_movements
  drop constraint if exists stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check
  check (type in (
    'purchase','sale','loss','damage','return',
    'transfer_in','transfer_out','adjustment_in','adjustment_out'
  ));

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
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantidade deve ser maior que zero'; end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and company_id = public.get_user_company_id()
  for update;

  if not found then raise exception 'Produto não encontrado'; end if;

  if p_type in ('purchase','return','transfer_in','adjustment_in') then
    v_delta := p_quantity;
  elsif p_type in ('sale','loss','damage','transfer_out','adjustment_out') then
    v_delta := -p_quantity;
  else
    raise exception 'Tipo de movimentação inválido';
  end if;

  v_previous := v_product.stock_quantity;
  v_new := v_previous + v_delta;

  if v_new < 0 then raise exception 'Estoque insuficiente para o produto: %', v_product.name; end if;

  update public.products
  set stock_quantity = v_new, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements(
    company_id, product_id, type, quantity,
    previous_quantity, new_quantity, reason, reference_id, user_id
  )
  values (
    v_product.company_id, p_product_id, p_type, p_quantity,
    v_previous, v_new, p_reason, p_reference_id, auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.apply_stock_movement_with_reference(uuid,text,numeric,text,uuid) from public;
grant execute on function public.apply_stock_movement_with_reference(uuid,text,numeric,text,uuid) to authenticated;

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
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_total numeric := 0;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'A compra precisa ter pelo menos um item'; end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = p_supplier_id and company_id = v_company_id
  ) then
    raise exception 'Fornecedor não encontrado';
  end if;

  insert into public.purchases(company_id,supplier_id,invoice_number,total,status,notes,created_by)
  values (v_company_id,p_supplier_id,nullif(trim(p_invoice_number),''),0,'received',nullif(trim(p_notes),''),auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := coalesce(nullif(v_item->>'unit_cost','')::numeric,0);

    if v_quantity is null or v_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
    if v_unit_cost < 0 then raise exception 'Custo inválido'; end if;

    if not exists (
      select 1 from public.products where id = v_product_id and company_id = v_company_id and active = true
    ) then raise exception 'Produto não encontrado'; end if;

    insert into public.purchase_items(purchase_id,product_id,quantity,unit_cost)
    values(v_purchase_id,v_product_id,v_quantity,v_unit_cost);

    v_total := v_total + (v_quantity * v_unit_cost);

    perform public.apply_stock_movement_with_reference(
      v_product_id,'purchase',v_quantity,'Compra'::text,v_purchase_id
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
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_total numeric := 0;
  v_product public.products%rowtype;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'A venda precisa ter pelo menos um item'; end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and company_id = v_company_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;

  insert into public.sales(company_id,customer_id,total,status,notes,created_by)
  values(v_company_id,p_customer_id,0,'completed',nullif(trim(p_notes),''),auth.uid())
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

    perform public.apply_stock_movement_with_reference(
      v_product_id,'sale',v_quantity,'Venda'::text,v_sale_id
    );
  end loop;

  update public.sales set total = v_total where id = v_sale_id;
  return v_sale_id;
end;
$$;

revoke all on function public.create_sale(uuid,text,jsonb) from public;
grant execute on function public.create_sale(uuid,text,jsonb) to authenticated;

create index if not exists purchases_company_created_idx on public.purchases(company_id,created_at desc);
create index if not exists sales_company_created_idx on public.sales(company_id,created_at desc);
create index if not exists stock_movements_reference_idx on public.stock_movements(reference_id);
