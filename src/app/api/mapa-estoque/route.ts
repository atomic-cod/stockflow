import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const warehouseId = new URL(request.url).searchParams.get("warehouse_id");
  const { data: warehouses, error: warehouseError } = await supabase
    .from("warehouses")
    .select("id,name,code,address,active")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (warehouseError) return NextResponse.json({ error: warehouseError.message }, { status: 400 });
  if (!warehouses?.length) return NextResponse.json({ warehouses: [], locations: [] });

  const selected = warehouseId && warehouses.some((w) => w.id === warehouseId)
    ? warehouseId
    : warehouses[0].id;

  const { data, error } = await supabase.rpc("get_warehouse_map", { p_warehouse_id: selected });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const locations = (data ?? []).map((item: Record<string, unknown>) => ({
    ...item,
    occupied: Number(item.occupied ?? 0),
    utilization: Number(item.utilization ?? 0),
    x: Number(item.x ?? 0),
    y: Number(item.y ?? 0),
    z: Number(item.z ?? 0),
    width: Number(item.width ?? 1),
    depth: Number(item.depth ?? 1),
    height: Number(item.height ?? 1),
    capacity: item.capacity == null ? null : Number(item.capacity),
    products: Array.isArray(item.products) ? item.products : [],
  }));

  const occupied = locations.reduce((sum, l) => sum + l.occupied, 0);
  const capacity = locations.reduce((sum, l) => sum + (l.capacity ?? 0), 0);

  return NextResponse.json({
    warehouse: warehouses.find((w) => w.id === selected) ?? warehouses[0],
    warehouses,
    locations,
    summary: {
      locations: locations.length,
      occupied,
      capacity,
      utilization: capacity ? Math.round((occupied / capacity) * 1000) / 10 : 0,
      products: locations.reduce((sum, l) => sum + l.products.length, 0),
    },
  });
}
