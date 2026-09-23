import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, companyId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();
  return { supabase, user, companyId: profile?.company_id ?? null };
}

export async function GET() {
  const { supabase, user } = await getContext();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("warehouses")
    .select("id,name,code,address,active,created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, companyId } = await getContext();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  const address = String(body.address ?? "").trim() || null;

  if (!name || !code) {
    return NextResponse.json({ error: "Nome e código são obrigatórios." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ company_id: companyId, name, code, address })
    .select("id,name,code,address,active,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um depósito com este código." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.rpc("log_audit", {
    p_action: "create",
    p_entity: "warehouse",
    p_entity_id: data.id,
    p_details: { name: data.name, code: data.code },
  });

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.code !== undefined) patch.code = String(body.code).trim().toUpperCase();
  if (body.address !== undefined) patch.address = String(body.address).trim() || null;
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const { data, error } = await supabase
    .from("warehouses")
    .update(patch)
    .eq("id", id)
    .select("id,name,code,address,active,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
