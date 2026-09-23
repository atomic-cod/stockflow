-- 015_operations_hardening.sql
-- Scanner validation, location-aware picking and operational scan context.

create or replace function public.get_scan_context(
  p_code text,
  p_warehouse_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_product public.products%rowtype;
  v_stock public.warehouse_stock%rowtype;
  v_location public.warehouse_locations%rowtype;
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Não autenticado';
  end if;
  if nullif(trim(p_code), '') is null then
    raise exception 'Informe SKU ou código de barras';
  end if;

  select * into v_product
  from public.products
  where company_id = v_company_id
    and active = true
    and (lower(sku) = lower(trim(p_code)) or lower(coalesce(barcode,'')) = lower(trim(p_code)))
  limit 1;

  if not found then
    raise exception 'Produto não encontrado para o código informado';
  end if;

  select * into v_stock
  from public.warehouse_stock
  where company_id = v_company_id
    and warehouse_id = p_warehouse_id
    and product_id = v_product.id;

  if v_stock.location_id is not null then
    select * into v_location
    from public.warehouse_locations
    where id = v_stock.location_id
      and company_id = v_company_id
      and warehouse_id = p_warehouse_id
      and active = true;
  end if;

  return jsonb_build_object(
    'product', jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'sku', v_product.sku,
      'barcode', v_product.barcode,
      'stock_quantity', v_product.stock_quantity
    ),
    'warehouse', jsonb_build_object(
      'id', p_warehouse_id,
      'quantity', coalesce(v_stock.quantity, 0)
    ),
    'location', case when v_location.id is null then null else jsonb_build_object(
      'id', v_location.id,
      'code', v_location.code,
      'name', v_location.name,
      'aisle', v_location.aisle,
      'rack', v_location.rack,
      'level', v_location.level
    ) end
  );
end;
$$;

revoke all on function public.get_scan_context(text,uuid) from public;
grant execute on function public.get_scan_context(text,uuid) to authenticated;

create or replace function public.confirm_picking_item(
  p_item_id uuid,
  p_quantity numeric,
  p_barcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_item public.warehouse_task_items%rowtype;
  v_task public.warehouse_tasks%rowtype;
  v_product public.products%rowtype;
  v_stock public.warehouse_stock%rowtype;
  v_location public.warehouse_locations%rowtype;
  v_remaining numeric;
  v_new_picked numeric;
  v_code text := nullif(trim(p_barcode), '');
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantidade inválida'; end if;

  select * into v_item from public.warehouse_task_items
  where id=p_item_id and company_id=v_company_id for update;
  if not found then raise exception 'Item de picking não encontrado'; end if;

  select * into v_task from public.warehouse_tasks
  where id=v_item.task_id and company_id=v_company_id for update;
  if not found or v_task.task_type <> 'picking' then raise exception 'Tarefa de picking inválida'; end if;
  if v_task.status in ('completed','cancelled') then raise exception 'Tarefa já encerrada'; end if;

  select * into v_product from public.products
  where id=v_item.product_id and company_id=v_company_id and active=true for update;
  if not found then raise exception 'Produto não encontrado'; end if;

  if v_code is not null and lower(v_code) <> lower(coalesce(v_product.barcode,'')) and lower(v_code) <> lower(v_product.sku) then
    raise exception 'Código escaneado não corresponde ao produto: %', v_product.name;
  end if;

  v_remaining := v_item.requested_quantity - v_item.picked_quantity;
  if p_quantity > v_remaining then raise exception 'Quantidade maior que o saldo a separar'; end if;

  select * into v_stock from public.warehouse_stock
  where company_id=v_company_id and warehouse_id=v_task.warehouse_id and product_id=v_item.product_id
  for update;
  if not found or v_stock.quantity < p_quantity then
    raise exception 'Estoque insuficiente no depósito para %', v_product.name;
  end if;

  if v_item.location_id is not null and v_stock.location_id is not null and v_item.location_id <> v_stock.location_id then
    raise exception 'O endereço da tarefa não corresponde ao endereço atual do estoque';
  end if;

  if v_item.location_id is null and v_stock.location_id is not null then
    v_item.location_id := v_stock.location_id;
    update public.warehouse_task_items set location_id=v_stock.location_id, updated_at=now() where id=v_item.id;
  end if;

  if v_stock.location_id is not null then
    select * into v_location from public.warehouse_locations where id=v_stock.location_id and active=true;
  end if;

  update public.warehouse_stock
  set quantity=quantity-p_quantity, updated_at=now()
  where id=v_stock.id;

  update public.products
  set stock_quantity=stock_quantity-p_quantity, updated_at=now()
  where id=v_product.id;

  v_new_picked := v_item.picked_quantity + p_quantity;
  update public.warehouse_task_items
  set picked_quantity=v_new_picked,
      status=case when v_new_picked >= requested_quantity then 'picked' else 'partial' end,
      scanned_barcode=coalesce(v_code, scanned_barcode),
      updated_at=now()
  where id=v_item.id;

  insert into public.stock_movements(
    company_id, product_id, type, quantity, previous_quantity, new_quantity,
    reason, reference_id, user_id
  ) values (
    v_company_id, v_product.id, 'sale', p_quantity,
    v_product.stock_quantity, v_product.stock_quantity-p_quantity,
    'Picking / separação', v_task.id, auth.uid()
  );

  if not exists (select 1 from public.warehouse_task_items where task_id=v_task.id and status in ('pending','partial')) then
    update public.warehouse_tasks set status='completed', completed_at=now(), updated_at=now() where id=v_task.id;
  else
    update public.warehouse_tasks set status='in_progress', started_at=coalesce(started_at,now()), updated_at=now() where id=v_task.id and status='open';
  end if;

  perform public.log_audit('pick', 'warehouse_task', v_task.id,
    jsonb_build_object('item_id',v_item.id,'product_id',v_product.id,'quantity',p_quantity,'location_id',v_stock.location_id,'barcode',v_code));

  return jsonb_build_object(
    'task_id',v_task.id,'item_id',v_item.id,'product_id',v_product.id,
    'picked_quantity',v_new_picked,'requested_quantity',v_item.requested_quantity,
    'task_status',(select status from public.warehouse_tasks where id=v_task.id),
    'location',case when v_location.id is null then null else jsonb_build_object('id',v_location.id,'code',v_location.code,'name',v_location.name) end
  );
end;
$$;

revoke all on function public.confirm_picking_item(uuid,numeric,text) from public;
grant execute on function public.confirm_picking_item(uuid,numeric,text) to authenticated;
