-- StockFlow: restore the stock consistency RPC if it is missing from a database
-- whose migration history already contains 010.
--
-- This migration is intentionally idempotent so it is safe to apply to
-- environments where the function already exists.

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
