-- 014_operations_picking_addressing.sql
-- Central operacional: tarefas de picking, endereçamento físico e execução por scanner.

create table if not exists public.warehouse_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  task_type text not null default 'picking'
    check (task_type in ('receiving','putaway','picking','packing','shipping','count','transfer')),
  status text not null default 'open'
    check (status in ('open','in_progress','completed','cancelled')),
  priority integer not null default 2 check (priority between 1 and 5),
  reference_code text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_task_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.warehouse_tasks(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  location_id uuid references public.warehouse_locations(id) on delete set null,
  requested_quantity numeric(12,3) not null check (requested_quantity > 0),
  picked_quantity numeric(12,3) not null default 0 check (picked_quantity >= 0),
  status text not null default 'pending'
    check (status in ('pending','partial','picked','cancelled')),
  scanned_barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_tasks_company_status_idx
  on public.warehouse_tasks(company_id, status, priority, created_at);
create index if not exists warehouse_tasks_warehouse_idx
  on public.warehouse_tasks(company_id, warehouse_id, status);
create index if not exists warehouse_task_items_task_idx
  on public.warehouse_task_items(task_id, status);
create index if not exists warehouse_task_items_product_idx
  on public.warehouse_task_items(company_id, product_id);

alter table public.warehouse_tasks enable row level security;
alter table public.warehouse_task_items enable row level security;

drop policy if exists "tasks select company members" on public.warehouse_tasks;
create policy "tasks select company members" on public.warehouse_tasks for select
using (company_id = public.get_user_company_id());

drop policy if exists "tasks insert managers" on public.warehouse_tasks;
create policy "tasks insert managers" on public.warehouse_tasks for insert
with check (company_id = public.get_user_company_id());

drop policy if exists "tasks update company members" on public.warehouse_tasks;
create policy "tasks update company members" on public.warehouse_tasks for update
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

drop policy if exists "task items select company members" on public.warehouse_task_items;
create policy "task items select company members" on public.warehouse_task_items for select
using (company_id = public.get_user_company_id());

drop policy if exists "task items insert company members" on public.warehouse_task_items;
create policy "task items insert company members" on public.warehouse_task_items for insert
with check (company_id = public.get_user_company_id());

drop policy if exists "task items update company members" on public.warehouse_task_items;
create policy "task items update company members" on public.warehouse_task_items for update
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

create or replace function public.assign_product_location(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Não autenticado'; end if;
  if not exists (select 1 from public.products where id=p_product_id and company_id=v_company_id and active=true) then
    raise exception 'Produto não encontrado';
  end if;
  if not exists (select 1 from public.warehouses where id=p_warehouse_id and company_id=v_company_id and active=true) then
    raise exception 'Depósito não encontrado';
  end if;
  if not exists (select 1 from public.warehouse_locations where id=p_location_id and warehouse_id=p_warehouse_id and company_id=v_company_id and active=true) then
    raise exception 'Endereço não encontrado no depósito';
  end if;

  insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity, location_id)
  values(v_company_id, p_warehouse_id, p_product_id, 0, p_location_id)
  on conflict (company_id, warehouse_id, product_id)
  do update set location_id=excluded.location_id, updated_at=now();

  perform public.log_audit('address', 'product', p_product_id,
    jsonb_build_object('warehouse_id',p_warehouse_id,'location_id',p_location_id));

  return jsonb_build_object('product_id',p_product_id,'warehouse_id',p_warehouse_id,'location_id',p_location_id);
end;
$$;

revoke all on function public.assign_product_location(uuid,uuid,uuid) from public;
grant execute on function public.assign_product_location(uuid,uuid,uuid) to authenticated;

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
  v_remaining numeric;
  v_new_picked numeric;
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

  v_remaining := v_item.requested_quantity - v_item.picked_quantity;
  if p_quantity > v_remaining then raise exception 'Quantidade maior que o saldo a separar'; end if;

  select * into v_stock from public.warehouse_stock
  where company_id=v_company_id and warehouse_id=v_task.warehouse_id and product_id=v_item.product_id
  for update;
  if not found or v_stock.quantity < p_quantity then
    raise exception 'Estoque insuficiente no endereço/deposito para %', v_product.name;
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
      scanned_barcode=coalesce(nullif(trim(p_barcode),''), scanned_barcode),
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

  if not exists (
    select 1 from public.warehouse_task_items
    where task_id=v_task.id and status in ('pending','partial')
  ) then
    update public.warehouse_tasks
    set status='completed', completed_at=now(), updated_at=now()
    where id=v_task.id;
  else
    update public.warehouse_tasks
    set status='in_progress', started_at=coalesce(started_at,now()), updated_at=now()
    where id=v_task.id and status='open';
  end if;

  perform public.log_audit('pick', 'warehouse_task', v_task.id,
    jsonb_build_object('item_id',v_item.id,'product_id',v_product.id,'quantity',p_quantity));

  return jsonb_build_object(
    'task_id',v_task.id,'item_id',v_item.id,'product_id',v_product.id,
    'picked_quantity',v_new_picked,'requested_quantity',v_item.requested_quantity,
    'task_status',(select status from public.warehouse_tasks where id=v_task.id)
  );
end;
$$;

revoke all on function public.confirm_picking_item(uuid,numeric,text) from public;
grant execute on function public.confirm_picking_item(uuid,numeric,text) to authenticated;
