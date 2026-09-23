-- StockFlow: workspace settings and warehouse hardening

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
