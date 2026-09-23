import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Perfil da empresa não encontrado." }, { status: 403 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const sku = String(body.sku ?? "").trim();
    const barcode = String(body.barcode ?? "").trim() || null;
    const description = String(body.description ?? "").trim() || null;
    const brand = String(body.brand ?? "").trim() || null;
    const unit = String(body.unit ?? "UN").trim().toUpperCase() || "UN";
    const lot = String(body.lot ?? "").trim() || null;
    const expiry_date = String(body.expiry_date ?? "").trim() || null;
    const location = String(body.location ?? "").trim() || null;
    const cost_price = Number(body.cost_price ?? 0);
    const sale_price = Number(body.sale_price ?? 0);
    const minimum_stock = Number(body.minimum_stock ?? 0);
    const maximum_stock = body.maximum_stock === "" || body.maximum_stock == null ? null : Number(body.maximum_stock);
    const category_id = body.category_id || null;
    const supplier_id = body.supplier_id || null;

    if (!name || !sku) return NextResponse.json({ error: "Nome e SKU são obrigatórios." }, { status: 400 });
    if (![cost_price,sale_price,minimum_stock].every(Number.isFinite) || (maximum_stock !== null && !Number.isFinite(maximum_stock))) {
      return NextResponse.json({ error: "Valores numéricos inválidos." }, { status: 400 });
    }
    if (cost_price < 0 || sale_price < 0 || minimum_stock < 0 || (maximum_stock !== null && maximum_stock < 0)) {
      return NextResponse.json({ error: "Os valores não podem ser negativos." }, { status: 400 });
    }

    const { data: product, error } = await supabase.from("products").insert({
      company_id: profile.company_id, category_id, supplier_id, name, sku, barcode, description,
      brand, unit, lot, expiry_date, location, cost_price, sale_price, minimum_stock, maximum_stock
    }).select().single();

    if (error) {
      if (error.code === "23505") {
        const message = error.message?.toLowerCase().includes("barcode")
          ? "Já existe um produto com este código de barras nesta empresa."
          : "Já existe um produto com este SKU nesta empresa.";
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase.rpc("log_audit", {
      p_action: "create", p_entity: "product", p_entity_id: product.id,
      p_details: { name: product.name, sku: product.sku }
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível cadastrar o produto." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";

    let query = supabase.from("products")
      .select("id,name,sku,barcode,brand,unit,lot,expiry_date,cost_price,sale_price,stock_quantity,minimum_stock,maximum_stock,location,active,created_at,category_id,supplier_id")
      .eq("active", true).order("created_at", { ascending: false });

    if (q) query = query.or("name.ilike.%" + q + "%,sku.ilike.%" + q + "%,barcode.ilike.%" + q + "%");
    const { data: products, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ products: products ?? [] });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os produtos." }, { status: 500 });
  }
}
