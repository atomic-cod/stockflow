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
