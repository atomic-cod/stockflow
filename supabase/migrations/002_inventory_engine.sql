create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  total numeric(12,2) not null default 0,
  status text not null default 'received' check (status in ('draft','received','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  total numeric(12,2) generated always as (quantity * unit_cost) stored
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(12,2) not null default 0,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total numeric(12,2) generated always as (quantity * unit_price) stored
);

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "company members manage purchases" on public.purchases for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

create policy "company members manage sales" on public.sales for all to authenticated
using (company_id = public.get_user_company_id())
with check (company_id = public.get_user_company_id());

create policy "company members manage purchase items" on public.purchase_items for all to authenticated
using (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()))
with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()));

create policy "company members manage sale items" on public.sale_items for all to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()))
with check (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()));

create or replace function public.apply_stock_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text default null
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

  select * into v_product from public.products
  where id = p_product_id and company_id = public.get_user_company_id()
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

  if v_new < 0 then raise exception 'Estoque insuficiente'; end if;

  update public.products
  set stock_quantity = v_new, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements(company_id, product_id, type, quantity, previous_quantity, new_quantity, reason, user_id)
  values (v_product.company_id, p_product_id, p_type, p_quantity, v_previous, v_new, p_reason, auth.uid())
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.apply_stock_movement(uuid,text,numeric,text) from public;
grant execute on function public.apply_stock_movement(uuid,text,numeric,text) to authenticated;
