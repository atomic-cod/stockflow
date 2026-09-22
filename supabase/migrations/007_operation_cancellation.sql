-- StockFlow Pro: cancelamento seguro de compras e vendas

create or replace function public.cancel_purchase(p_purchase_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_status text;
  v_item record;
begin
  if auth.uid() is null or not public.has_role(array['admin','manager']) then
    raise exception 'Apenas administradores e gerentes podem cancelar compras';
  end if;

  select status into v_status
  from public.purchases
  where id = p_purchase_id and company_id = v_company_id
  for update;

  if v_status is null then raise exception 'Compra não encontrada'; end if;
  if v_status = 'cancelled' then raise exception 'Compra já cancelada'; end if;

  for v_item in
    select product_id, quantity
    from public.purchase_items
    where purchase_id = p_purchase_id
  loop
    perform public.apply_stock_movement_with_reference(
      v_item.product_id,
      'adjustment_out',
      v_item.quantity,
      'Cancelamento de compra',
      p_purchase_id
    );
  end loop;

  update public.purchases set status = 'cancelled' where id = p_purchase_id;

  perform public.log_audit(
    'cancel',
    'purchase',
    p_purchase_id,
    jsonb_build_object('status','cancelled')
  );

  return true;
end;
$$;

revoke all on function public.cancel_purchase(uuid) from public;
grant execute on function public.cancel_purchase(uuid) to authenticated;

create or replace function public.cancel_sale(p_sale_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_status text;
  v_item record;
begin
  if auth.uid() is null or not public.has_role(array['admin','manager']) then
    raise exception 'Apenas administradores e gerentes podem cancelar vendas';
  end if;

  select status into v_status
  from public.sales
  where id = p_sale_id and company_id = v_company_id
  for update;

  if v_status is null then raise exception 'Venda não encontrada'; end if;
  if v_status = 'cancelled' then raise exception 'Venda já cancelada'; end if;

  for v_item in
    select product_id, quantity
    from public.sale_items
    where sale_id = p_sale_id
  loop
    perform public.apply_stock_movement_with_reference(
      v_item.product_id,
      'return',
      v_item.quantity,
      'Cancelamento de venda',
      p_sale_id
    );
  end loop;

  update public.sales set status = 'cancelled' where id = p_sale_id;

  perform public.log_audit(
    'cancel',
    'sale',
    p_sale_id,
    jsonb_build_object('status','cancelled')
  );

  return true;
end;
$$;

revoke all on function public.cancel_sale(uuid) from public;
grant execute on function public.cancel_sale(uuid) to authenticated;
