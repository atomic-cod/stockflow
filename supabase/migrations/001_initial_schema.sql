create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('admin','manager','employee','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(company_id,name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  sku text not null,
  barcode text,
  description text,
  image_url text,
  cost_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  stock_quantity numeric(12,3) not null default 0,
  minimum_stock numeric(12,3) not null default 0,
  maximum_stock numeric(12,3),
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,sku)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null,
  quantity numeric(12,3) not null,
  previous_quantity numeric(12,3) not null,
  new_quantity numeric(12,3) not null,
  reason text,
  reference_id uuid,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists products_company_id_idx on public.products(company_id);
create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_sku_idx on public.products(sku);
create index if not exists stock_movements_company_id_idx on public.stock_movements(company_id);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create or replace function public.get_user_company_id()
returns uuid language sql stable security definer set search_path=public
as $$ select company_id from public.profiles where id=auth.uid() limit 1; $$;

create policy if not exists "company members can view company" on public.companies for select to authenticated using (id=public.get_user_company_id());
create policy if not exists "company members can view profiles" on public.profiles for select to authenticated using (company_id=public.get_user_company_id());
create policy if not exists "company members can manage categories" on public.categories for all to authenticated using (company_id=public.get_user_company_id()) with check (company_id=public.get_user_company_id());
create policy if not exists "company members can manage suppliers" on public.suppliers for all to authenticated using (company_id=public.get_user_company_id()) with check (company_id=public.get_user_company_id());
create policy if not exists "company members can manage customers" on public.customers for all to authenticated using (company_id=public.get_user_company_id()) with check (company_id=public.get_user_company_id());
create policy if not exists "company members can manage products" on public.products for all to authenticated using (company_id=public.get_user_company_id()) with check (company_id=public.get_user_company_id());
create policy if not exists "company members can view movements" on public.stock_movements for select to authenticated using (company_id=public.get_user_company_id());