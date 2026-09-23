-- StockFlow: workspace settings and warehouse hardening
--
-- Recovery guard: migration 006 is recorded in some environments while
-- its role helper functions are missing from the live schema. Recreate them
-- idempotently before policies below depend on them.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = any(p_roles), false);
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;

-- Recovery guard: migration 004 is recorded in some environments while
-- its advanced tables/functions are missing from the live schema. Recreate
-- the missing structures idempotently before policies and migration 009 depend on them.

alter table public.products
  add column if not exists brand text,
  add column if not exists unit text not null default 'UN',
  add column if not exists lot text,
  add column if not exists expiry_date date;

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  expected_quantity numeric(12,3) not null,
  counted_quantity numeric(12,3) not null,
  difference numeric(12,3) generated always as (counted_quantity - expected_quantity) stored,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.warehouses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.inventory_counts enable row level security;

create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare v_company_id uuid := public.get_user_company_id();
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Não autenticado';
  end if;
  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,details)
  values(v_company_id,auth.uid(),p_action,p_entity,p_entity_id,coalesce(p_details,'{}'::jsonb));
end;
$;

revoke all on function public.log_audit(text,text,uuid,jsonb) from public;
grant execute on function public.log_audit(text,text,uuid,jsonb) to authenticated;

-- Restore the member-read policies that migration 004 normally creates.
drop policy if exists "company members view audit logs" on public.audit_logs;
create policy "company members view audit logs"
on public.audit_logs for select to authenticated
using (company_id = public.get_user_company_id());

drop policy if exists "company members view inventory counts" on public.inventory_counts;
create policy "company members view inventory counts"
on public.inventory_counts for select to authenticated
using (company_id = public.get_user_company_id());

create index if not exists products_expiry_idx on public.products(company_id, expiry_date);
create index if not exists products_stock_idx on public.products(company_id, stock_quantity, minimum_stock);
create index if not exists audit_logs_company_created_idx on public.audit_logs(company_id, created_at desc);
create index if not exists inventory_counts_company_created_idx on public.inventory_counts(company_id, created_at desc);

-- Only workspace admins can change company settings.
drop policy if exists "company admins update company" on public.companies;
create policy "company admins update company"
on public.companies for update to authenticated
using (
  id = public.get_user_company_id()
  and public.current_user_role() = 'admin'
)
with check (
  id = public.get_user_company_id()
);

-- Warehouse mutations are restricted to admins and managers.
drop policy if exists "company members manage warehouses" on public.warehouses;
create policy "company members view warehouses"
on public.warehouses for select to authenticated
using (company_id = public.get_user_company_id());

create policy "managers manage warehouses"
on public.warehouses for insert to authenticated
with check (
  company_id = public.get_user_company_id()
  and public.has_role(array['admin','manager'])
);

create policy "managers update warehouses"
on public.warehouses for update to authenticated
using (
  company_id = public.get_user_company_id()
  and public.has_role(array['admin','manager'])
)
with check (
  company_id = public.get_user_company_id()
  and public.has_role(array['admin','manager'])
);

create policy "admins delete warehouses"
on public.warehouses for delete to authenticated
using (
  company_id = public.get_user_company_id()
  and public.has_role(array['admin'])
);

create index if not exists companies_created_at_idx
  on public.companies(created_at desc);
