-- StockFlow: recovery for environments where migrations 009/010 are
-- recorded as applied but warehouse stock objects are missing.
--
-- This migration is intentionally idempotent.

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_stock'
      and policyname = 'company members view warehouse stock'
  ) then
    create policy "company members view warehouse stock"
      on public.warehouse_stock
      for select
      to authenticated
      using (company_id = public.get_user_company_id());
  end if;
end;
$$;

create index if not exists warehouse_stock_company_idx
  on public.warehouse_stock(company_id, warehouse_id, product_id);

create index if not exists warehouse_stock_product_idx
  on public.warehouse_stock(company_id, product_id);

-- Restore a primary warehouse for companies that do not have one.
insert into public.warehouses(company_id, name, code, address, active)
select c.id, 'Depósito Principal', 'PRINCIPAL', null, true
from public.companies c
where not exists (
  select 1
  from public.warehouses w
  where w.company_id = c.id
);

-- Seed/reconcile existing global stock into the oldest active warehouse.
insert into public.warehouse_stock(company_id, warehouse_id, product_id, quantity)
select p.company_id, w.id, p.id, p.stock_quantity
from public.products p
join lateral (
  select id
  from public.warehouses
  where company_id = p.company_id
    and active = true
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
