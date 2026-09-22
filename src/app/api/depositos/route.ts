import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("warehouses")
    .select("id,name,code,address,active,created_at")
    .eq("active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ warehouses: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  const address = String(body.address ?? "").trim() || null;

  if (!name || !code) {
    return NextResponse.json({ error: "Nome e código são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ company_id: profile.company_id, name, code, address })
    .select("id,name,code,address,active,created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um depósito com este código." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.rpc("log_audit", {
    p_action: "create",
    p_entity: "warehouse",
    p_entity_id: data.id,
    p_details: { name, code }
  });

  return NextResponse.json({ warehouse: data }, { status: 201 });
}
