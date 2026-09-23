-- 013_stock_map.sql
-- Advanced warehouse map: physical locations, 3D coordinates and stock assignment.

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text not null,
  location_type text not null default 'bin'
    check (location_type in ('zone','aisle','rack','shelf','bin','floor','receiving','shipping')),
  aisle text,
  rack text,
  level integer,
  x numeric(10,2) not null default 0,
  y numeric(10,2) not null default 0,
  z numeric(10,2) not null default 0,
  width numeric(10,2) not null default 1,
  depth numeric(10,2) not null default 1,
  height numeric(10,2) not null default 1,
  capacity numeric(14,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, warehouse_id, code)
);

alter table public.warehouse_stock
  add column if not exists location_id uuid references public.warehouse_locations(id) on delete set null;

create index if not exists idx_warehouse_locations_warehouse on public.warehouse_locations(warehouse_id, active);
create index if not exists idx_warehouse_locations_coords on public.warehouse_locations(warehouse_id, x, y, z);
create index if not exists idx_warehouse_stock_location on public.warehouse_stock(location_id);

alter table public.warehouse_locations enable row level security;

drop policy if exists "warehouse locations select company members" on public.warehouse_locations;
create policy "warehouse locations select company members"
on public.warehouse_locations for select
using (company_id = public.get_user_company_id());

drop policy if exists "warehouse locations insert managers" on public.warehouse_locations;
create policy "warehouse locations insert managers"
on public.warehouse_locations for insert
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "warehouse locations update managers" on public.warehouse_locations;
create policy "warehouse locations update managers"
on public.warehouse_locations for update
using (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']))
with check (company_id = public.get_user_company_id() and public.has_role(array['admin','manager']));

drop policy if exists "warehouse locations delete admins" on public.warehouse_locations;
create policy "warehouse locations delete admins"
on public.warehouse_locations for delete
using (company_id = public.get_user_company_id() and public.has_role(array['admin']));

create or replace function public.get_warehouse_map(p_warehouse_id uuid default null)
returns table (
  warehouse_id uuid,
  warehouse_name text,
  location_id uuid,
  location_code text,
  location_name text,
  location_type text,
  aisle text,
  rack text,
  level integer,
  x numeric,
  y numeric,
  z numeric,
  width numeric,
  depth numeric,
  height numeric,
  capacity numeric,
  occupied numeric,
  utilization numeric,
  products jsonb
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select w.id, w.name
    from public.warehouses w
    where w.company_id = public.get_user_company_id()
      and w.active = true
      and (p_warehouse_id is null or w.id = p_warehouse_id)
    order by w.created_at asc
    limit case when p_warehouse_id is null then 1 else 1 end
  ),
  stock as (
    select
      ws.location_id,
      sum(ws.quantity)::numeric as occupied,
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'name', p.name,
          'sku', p.sku,
          'barcode', p.barcode,
          'quantity', ws.quantity,
          'unit', p.unit,
          'image_url', p.image_url,
          'minimum_stock', p.minimum_stock
        )
        order by p.name
      ) as products
    from public.warehouse_stock ws
    join public.products p on p.id = ws.product_id
    where ws.company_id = public.get_user_company_id()
      and ws.warehouse_id in (select id from target)
      and ws.location_id is not null
      and ws.quantity > 0
    group by ws.location_id
  )
  select
    l.warehouse_id,
    t.name,
    l.id,
    l.code,
    l.name,
    l.location_type,
    l.aisle,
    l.rack,
    l.level,
    l.x,
    l.y,
    l.z,
    l.width,
    l.depth,
    l.height,
    l.capacity,
    coalesce(s.occupied,0),
    case when coalesce(l.capacity,0) > 0
      then round((coalesce(s.occupied,0) / l.capacity) * 100, 1)
      else 0
    end,
    coalesce(s.products,'[]'::jsonb)
  from public.warehouse_locations l
  join target t on t.id = l.warehouse_id
  left join stock s on s.location_id = l.id
  where l.active = true
  order by l.z, l.y, l.x, l.code;
$$;

revoke all on function public.get_warehouse_map(uuid) from public;
grant execute on function public.get_warehouse_map(uuid) to authenticated;

-- Seed a compact starter grid for every active warehouse that has no map locations.
insert into public.warehouse_locations
  (company_id, warehouse_id, code, name, location_type, aisle, rack, level, x, y, z, width, depth, height, capacity)
select
  w.company_id,
  w.id,
  'A'||a.aisle||'-R'||r.rack||'-N'||n.level,
  'Corredor '||a.aisle||' · Rack '||r.rack||' · Nível '||n.level,
  'bin',
  a.aisle,
  r.rack,
  n.level,
  ((a.aisle_no - 1) * 7 + (r.rack_no - 1) * 1.6),
  ((r.rack_no - 1) * 1.8),
  ((n.level - 1) * 1.8),
  1.4, 1.5, 1.5, 100
from public.warehouses w
cross join (values ('01',1),('02',2),('03',3),('04',4)) as a(aisle,aisle_no)
cross join (values ('01',1),('02',2),('03',3),('04',4)) as r(rack,rack_no)
cross join (values (1),(2),(3),(4)) as n(level)
where w.active = true
  and not exists (
    select 1 from public.warehouse_locations l
    where l.warehouse_id = w.id
  );

-- Put existing unassigned stock into the first available map slot per warehouse,
-- preserving one source of truth in warehouse_stock.
with first_slot as (
  select distinct on (warehouse_id) warehouse_id, id
  from public.warehouse_locations
  where active = true
  order by warehouse_id, z, y, x, code
)
update public.warehouse_stock ws
set location_id = fs.id
from first_slot fs
where ws.warehouse_id = fs.warehouse_id
  and ws.location_id is null
  and ws.quantity > 0;
