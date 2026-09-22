-- StockFlow Pro: campos avançados, depósitos, alertas e auditoria

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

create policy "company members manage warehouses" on public.warehouses for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

create policy "company members view audit logs" on public.audit_logs for select to authenticated
using (company_id = public.get_user_company_id());

create policy "company members view inventory counts" on public.inventory_counts for select to authenticated
using (company_id = public.get_user_company_id());

create index if not exists products_expiry_idx on public.products(company_id, expiry_date);
create index if not exists products_stock_idx on public.products(company_id, stock_quantity, minimum_stock);
create index if not exists audit_logs_company_created_idx on public.audit_logs(company_id, created_at desc);
create index if not exists inventory_counts_company_created_idx on public.inventory_counts(company_id, created_at desc);

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
as $$
declare v_company_id uuid := public.get_user_company_id();
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Não autenticado';
  end if;
  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,details)
  values(v_company_id,auth.uid(),p_action,p_entity,p_entity_id,coalesce(p_details,'{}'::jsonb));
end;
$$;

revoke all on function public.log_audit(text,text,uuid,jsonb) from public;
grant execute on function public.log_audit(text,text,uuid,jsonb) to authenticated;
