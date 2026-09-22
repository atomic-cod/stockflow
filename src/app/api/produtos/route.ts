import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Perfil da empresa não encontrado." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const sku = String(body.sku ?? "").trim();
    const barcode = String(body.barcode ?? "").trim() || null;
    const description = String(body.description ?? "").trim() || null;
    const location = String(body.location ?? "").trim() || null;
    const costPrice = Number(body.cost_price ?? 0);
    const salePrice = Number(body.sale_price ?? 0);
    const minimumStock = Number(body.minimum_stock ?? 0);
    const maximumStock =
      body.maximum_stock === "" || body.maximum_stock == null
        ? null
        : Number(body.maximum_stock);

    if (!name || !sku) {
      return NextResponse.json(
        { error: "Nome e SKU são obrigatórios." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(salePrice) ||
      !Number.isFinite(minimumStock) ||
      (maximumStock !== null && !Number.isFinite(maximumStock))
    ) {
      return NextResponse.json(
        { error: "Os valores numéricos informados são inválidos." },
        { status: 400 }
      );
    }

    if (costPrice < 0 || salePrice < 0 || minimumStock < 0 || (maximumStock !== null && maximumStock < 0)) {
      return NextResponse.json(
        { error: "Os valores não podem ser negativos." },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        company_id: profile.company_id,
        name,
        sku,
        barcode,
        description,
        location,
        cost_price: costPrice,
        sale_price: salePrice,
        minimum_stock: minimumStock,
        maximum_stock: maximumStock,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um produto com este SKU nesta empresa." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar o produto." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: products, error } = await supabase
      .from("products")
      .select("id,name,sku,barcode,cost_price,sale_price,stock_quantity,minimum_stock,maximum_stock,location,active,created_at")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os produtos." },
      { status: 500 }
    );
  }
}
