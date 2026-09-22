import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowed = {
  fornecedores: { table: "suppliers", fields: ["name","document","email","phone","address"] },
  clientes: { table: "customers", fields: ["name","document","email","phone","address"] },
  categorias: { table: "categories", fields: ["name"] },
} as const;

type Entity = keyof typeof allowed;

export async function GET(_: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(entity in allowed)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });

  const config = allowed[entity as Entity];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase.from(config.table).select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(entity in allowed)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });

  const config = allowed[entity as Entity];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });

  const body = await request.json();
  const payload: Record<string, string> = { company_id: profile.company_id };
  for (const field of config.fields) payload[field] = String(body[field] ?? "").trim();

  if (!payload.name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const { data, error } = await supabase.from(config.table).insert(payload).select("*").single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Este cadastro já existe." : error.message }, { status: duplicate ? 409 : 400 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(entity in allowed)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });

  const config = allowed[entity as Entity];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

  const { error } = await supabase.from(config.table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
