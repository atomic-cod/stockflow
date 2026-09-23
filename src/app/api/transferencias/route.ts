import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const productId = new URL(request.url).searchParams.get("product_id");
  if (productId) {
    const { data, error } = await supabase.rpc("get_product_warehouse_stock", { p_product_id: productId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data ?? [] });
  }

  const { data, error } = await supabase
    .from("warehouses")
    .select("id,name,code,active")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ warehouses: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const productId = String(body.product_id ?? "");
  const fromWarehouseId = String(body.from_warehouse_id ?? "");
  const toWarehouseId = String(body.to_warehouse_id ?? "");
  const quantity = Number(body.quantity);
  const notes = String(body.notes ?? "").trim() || null;

  if (!productId || !fromWarehouseId || !toWarehouseId || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Produto, origem, destino e quantidade válida são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("transfer_stock", {
    p_product_id: productId,
    p_from_warehouse_id: fromWarehouseId,
    p_to_warehouse_id: toWarehouseId,
    p_quantity: quantity,
    p_notes: notes,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ transfer: data }, { status: 201 });
}
