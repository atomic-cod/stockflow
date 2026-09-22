-- StockFlow Pro: segurança, índices e regras para inventário físico

-- Evita códigos de barras duplicados dentro da mesma empresa.
create unique index if not exists products_company_barcode_uidx
  on public.products(company_id, barcode)
  where barcode is not null and barcode <> '';

-- Permite registrar contagens físicas pela própria aplicação.
create policy "company members create inventory counts"
  on public.inventory_counts for insert to authenticated
  with check (
    company_id = public.get_user_company_id()
    and created_by = auth.uid()
  );

create policy "company members manage own inventory counts"
  on public.inventory_counts for update to authenticated
  using (
    company_id = public.get_user_company_id()
    and created_by = auth.uid()
  )
  with check (
    company_id = public.get_user_company_id()
    and created_by = auth.uid()
  );

create index if not exists warehouses_company_name_idx
  on public.warehouses(company_id, name);

create index if not exists products_company_barcode_idx
  on public.products(company_id, barcode);

-- Função segura para concluir uma contagem física:
-- registra a contagem e, se houver diferença, cria o ajuste de estoque.
create or replace function public.complete_inventory_count(
  p_product_id uuid,
  p_counted_quantity numeric,
  p_notes text default null
)
returns public.inventory_counts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.get_user_company_id();
  v_product public.products%rowtype;
  v_count public.inventory_counts%rowtype;
  v_difference numeric;
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Não autenticado';
  end if;

  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'Quantidade contada inválida';
  end if;

  select *
    into v_product
    from public.products
   where id = p_product_id
     and company_id = v_company_id
     and active = true
   for update;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_difference := p_counted_quantity - v_product.stock_quantity;

  if v_difference > 0 then
    perform public.apply_stock_movement(
      p_product_id,
      'adjustment_in',
      v_difference,
      'Inventário físico'
    );
  elsif v_difference < 0 then
    perform public.apply_stock_movement(
      p_product_id,
      'adjustment_out',
      abs(v_difference),
      'Inventário físico'
    );
  end if;

  insert into public.inventory_counts(
    company_id, product_id, expected_quantity, counted_quantity, notes, created_by
  )
  values(
    v_company_id, p_product_id, v_product.stock_quantity,
    p_counted_quantity, nullif(trim(p_notes), ''), auth.uid()
  )
  returning * into v_count;

  perform public.log_audit(
    'inventory_count',
    'product',
    p_product_id,
    jsonb_build_object(
      'expected_quantity', v_product.stock_quantity,
      'counted_quantity', p_counted_quantity,
      'difference', v_difference
    )
  );

  return v_count;
end;
$$;

revoke all on function public.complete_inventory_count(uuid,numeric,text) from public;
grant execute on function public.complete_inventory_count(uuid,numeric,text) to authenticated;
