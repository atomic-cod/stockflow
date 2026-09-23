-- 015_operations_execution_hardening.sql
-- Execução WMS: contexto de scanner, validação de endereço e atualização segura do picking.

create index if not exists warehouse_tasks_assignment_idx
  on public.warehouse_tasks(company_id, assigned_to, status, priority, created_at);

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
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if p_warehouse_id is null then raise exception 'Depósito obrigatório'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'Código obrigatório'; end if;

  if not exists (
    select 1 from public.warehouses
    where id=p_warehouse_id and company_id=v_company_id and active=true
  ) then raise exception 'Depósito não encontrado'; end if;

  select * into v_product
  from public.products
  where company_id=v_company_id and active=true
    and (sku=trim(p_code) or barcode=trim(p_code) or id::text=trim(p_code))
  order by case when barcode=trim(p_code) then 0 when sku=trim(p_code) then 1 else 2 end
  limit 1;

  if not found then raise exception 'Produto não encontrado para o código: %', trim(p_code); end if;

  select * into v_stock
  from public.warehouse_stock
  where company_id=v_company_id and warehouse_id=p_warehouse_id and product_id=v_product.id;

  if v_stock.location_id is not null then
    select * into v_location from public.warehouse_locations
    where id=v_stock.location_id and warehouse_id=p_warehouse_id and company_id=v_company_id and active=true;
  end if;

  return jsonb_build_object(
    'product', jsonb_build_object(
      'id',v_product.id,'name',v_product.name,'sku',v_product.sku,
      'barcode',v_product.barcode,'stock_quantity',v_product.stock_quantity,
      'minimum_stock',v_product.minimum_stock,'image_url',v_product.image_url
    ),
    'warehouse', jsonb_build_object(
      'id',p_warehouse_id,'quantity',coalesce(v_stock.quantity,0),
      'location_id',v_stock.location_id
    ),
    'location', case when v_location.id is null then null else jsonb_build_object(
      'id',v_location.id,'code',v_location.code,'name',v_location.name,
      'aisle',v_location.aisle,'rack',v_location.rack,'level',v_location.level,
      'x',v_location.x,'y',v_location.y,'z',v_location.z
    ) end
  );
end;
$$;

revoke all on function public.get_scan_context(text,uuid) from public;
grant execute on function public.get_scan_context(text,uuid) to authenticated;

create or replace function public.assign_task(
  p_task_id uuid,
  p_user_id uuid default null
)
returns public.warehouse_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_task public.warehouse_tasks%rowtype;
  v_assignee uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  select * into v_task from public.warehouse_tasks
  where id=p_task_id and company_id=v_company_id for update;
  if not found then raise exception 'Tarefa não encontrada'; end if;
  if v_task.status in ('completed','cancelled') then raise exception 'Tarefa encerrada'; end if;
  if not exists (select 1 from public.profiles where id=v_assignee and company_id=v_company_id) then
    raise exception 'Operador não pertence à empresa';
  end if;

  update public.warehouse_tasks
  set assigned_to=v_assignee, status=case when status='open' then 'in_progress' else status end,
      started_at=coalesce(started_at,now()), updated_at=now()
  where id=p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

revoke all on function public.assign_task(uuid,uuid) from public;
grant execute on function public.assign_task(uuid,uuid) to authenticated;

create or replace function public.confirm_picking_item(
  p_item_id uuid,
  p_quantity numeric,
  p_barcode text default null,
  p_location_id uuid default null
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
  v_remaining numeric;
  v_new_picked numeric;
  v_task_status text;
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

  if nullif(trim(coalesce(p_barcode,'')),'') is not null
     and coalesce(v_product.barcode,'') <> trim(p_barcode)
     and v_product.sku <> trim(p_barcode) then
    raise exception 'Produto escaneado não corresponde ao item do picking';
  end if;

  v_remaining := v_item.requested_quantity - v_item.picked_quantity;
  if p_quantity > v_remaining then raise exception 'Quantidade maior que o saldo a separar'; end if;

  select * into v_stock from public.warehouse_stock
  where company_id=v_company_id and warehouse_id=v_task.warehouse_id and product_id=v_item.product_id
  for update;
  if not found or v_stock.quantity < p_quantity then raise exception 'Estoque insuficiente no depósito'; end if;

  if v_item.location_id is not null and v_stock.location_id is not null
     and v_item.location_id <> v_stock.location_id then
    raise exception 'O endereço do picking não corresponde ao endereço atual do estoque';
  end if;
  if p_location_id is not null and v_stock.location_id is not null and p_location_id <> v_stock.location_id then
    raise exception 'Endereço escaneado diferente do endereço do estoque';
  end if;

  update public.warehouse_stock set quantity=quantity-p_quantity, updated_at=now() where id=v_stock.id;
  update public.products set stock_quantity=stock_quantity-p_quantity, updated_at=now() where id=v_product.id;

  v_new_picked := v_item.picked_quantity + p_quantity;
  update public.warehouse_task_items
  set picked_quantity=v_new_picked,
      status=case when v_new_picked >= requested_quantity then 'picked' else 'partial' end,
      scanned_barcode=coalesce(nullif(trim(p_barcode),''), scanned_barcode), updated_at=now()
  where id=v_item.id;

  insert into public.stock_movements(company_id,product_id,type,quantity,previous_quantity,new_quantity,reason,reference_id,user_id)
  values(v_company_id,v_product.id,'sale',p_quantity,v_product.stock_quantity,v_product.stock_quantity-p_quantity,
    'Picking / separação',v_task.id,auth.uid());

  if not exists (select 1 from public.warehouse_task_items where task_id=v_task.id and status in ('pending','partial')) then
    update public.warehouse_tasks set status='completed',completed_at=now(),updated_at=now() where id=v_task.id;
  else
    update public.warehouse_tasks set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
    where id=v_task.id and status='open';
  end if;

  select status into v_task_status from public.warehouse_tasks where id=v_task.id;
  perform public.log_audit('pick','warehouse_task',v_task.id,
    jsonb_build_object('item_id',v_item.id,'product_id',v_product.id,'quantity',p_quantity,'barcode',p_barcode));

  return jsonb_build_object('task_id',v_task.id,'item_id',v_item.id,'product_id',v_product.id,
    'picked_quantity',v_new_picked,'requested_quantity',v_item.requested_quantity,'task_status',v_task_status,
    'location_id',v_stock.location_id);
end;
$$;

revoke all on function public.confirm_picking_item(uuid,numeric,text) from public;
revoke all on function public.confirm_picking_item(uuid,numeric,text,uuid) from public;
grant execute on function public.confirm_picking_item(uuid,numeric,text,uuid) to authenticated;
