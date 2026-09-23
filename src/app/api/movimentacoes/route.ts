import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const productId = String(body.product_id ?? "");
  const type = String(body.type ?? "");
  const quantity = Number(body.quantity);
  const reason = String(body.reason ?? "").trim() || null;

  if (!productId || !type || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Produto, tipo e quantidade válida são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("apply_stock_movement_with_reference", {
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason,
    p_reference_id: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ movement: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("stock_movements")
    .select("id,type,quantity,previous_quantity,new_quantity,reason,created_at,products(name,sku)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ movements: data });
}
