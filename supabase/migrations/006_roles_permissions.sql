-- StockFlow Pro: permissões por função e administração de equipe

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() limit 1;
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

-- Leitura permanece disponível para todos os membros da empresa.
drop policy if exists "company members can manage categories" on public.categories;
create policy "company members read categories" on public.categories for select to authenticated
using (company_id = public.get_user_company_id());
create policy "managers manage categories" on public.categories for all to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "company members can manage suppliers" on public.suppliers;
create policy "company members read suppliers" on public.suppliers for select to authenticated
using (company_id = public.get_user_company_id());
create policy "managers manage suppliers" on public.suppliers for all to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "company members can manage customers" on public.customers;
create policy "company members read customers" on public.customers for select to authenticated
using (company_id = public.get_user_company_id());
create policy "managers manage customers" on public.customers for all to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "company members can manage products" on public.products;
create policy "company members read products" on public.products for select to authenticated
using (company_id = public.get_user_company_id());
create policy "managers manage products" on public.products for all to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "company members manage purchases" on public.purchases;
create policy "company members read purchases" on public.purchases for select to authenticated
using (company_id = public.get_user_company_id());
create policy "operators create purchases" on public.purchases for insert to authenticated
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager','employee']));
create policy "managers update purchases" on public.purchases for update to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));
create policy "managers delete purchases" on public.purchases for delete to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "company members manage sales" on public.sales;
create policy "company members read sales" on public.sales for select to authenticated
using (company_id = public.get_user_company_id());
create policy "operators create sales" on public.sales for insert to authenticated
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager','employee']));
create policy "managers update sales" on public.sales for update to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));
create policy "managers delete sales" on public.sales for delete to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

-- Itens seguem o acesso da operação-pai.
drop policy if exists "company members manage purchase items" on public.purchase_items;
create policy "company members read purchase items" on public.purchase_items for select to authenticated
using (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()));
create policy "operators create purchase items" on public.purchase_items for insert to authenticated
with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager','employee']));
create policy "managers modify purchase items" on public.purchase_items for update to authenticated
using (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']))
with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']));
create policy "managers delete purchase items" on public.purchase_items for delete to authenticated
using (exists (select 1 from public.purchases p where p.id = purchase_id and p.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']));

drop policy if exists "company members manage sale items" on public.sale_items;
create policy "company members read sale items" on public.sale_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()));
create policy "operators create sale items" on public.sale_items for insert to authenticated
with check (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager','employee']));
create policy "managers modify sale items" on public.sale_items for update to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']))
with check (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']));
create policy "managers delete sale items" on public.sale_items for delete to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id and s.company_id = public.get_user_company_id()) and public.has_role(array['admin','manager']));

-- Administradores podem alterar funções, sem permitir remover o próprio acesso de admin.
create or replace function public.set_profile_role(p_user_id uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.has_role(array['admin']) then
    raise exception 'Apenas administradores podem alterar funções';
  end if;
  if p_role not in ('admin','manager','employee','viewer') then
    raise exception 'Função inválida';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'O administrador atual não pode remover o próprio acesso';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id
     and company_id = public.get_user_company_id()
  returning * into v_profile;

  if not found then raise exception 'Usuário não encontrado'; end if;

  perform public.log_audit(
    'role_change','profile',p_user_id,
    jsonb_build_object('new_role',p_role)
  );

  return v_profile;
end;
$$;

revoke all on function public.set_profile_role(uuid,text) from public;
grant execute on function public.set_profile_role(uuid,text) to authenticated;

drop policy if exists "company members can view profiles" on public.profiles;
create policy "company members can view profiles" on public.profiles for select to authenticated
using (company_id = public.get_user_company_id());
create policy "admins update profiles" on public.profiles for update to authenticated
using (company_id = public.get_user_company_id() and public.has_role(array['admin']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin']));

create index if not exists profiles_company_role_idx on public.profiles(company_id,role);
