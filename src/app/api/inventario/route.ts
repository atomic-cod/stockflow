import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("inventory_counts")
    .select("id,expected_quantity,counted_quantity,difference,notes,created_at,products(name,sku,unit)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ counts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const productId = String(body.product_id ?? "");
  const counted = Number(body.counted_quantity);
  const notes = String(body.notes ?? "").trim() || null;

  if (!productId || !Number.isFinite(counted) || counted < 0) {
    return NextResponse.json({ error: "Produto e quantidade contada válida são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("complete_inventory_count", {
    p_product_id: productId,
    p_counted_quantity: counted,
    p_notes: notes
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ count: data }, { status: 201 });
}
