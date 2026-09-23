import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id,role,full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("id,name,document,email,phone,created_at")
    .eq("id", profile.company_id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ company, role: profile.role, full_name: profile.full_name });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Somente administradores podem alterar a empresa." }, { status: 403 });

  const body = await request.json();
  const patch: Record<string, string | null> = {};

  for (const field of ["name", "document", "email", "phone"]) {
    if (body[field] !== undefined) {
      patch[field] = String(body[field] ?? "").trim() || null;
    }
  }

  if ("name" in patch && !patch.name) {
    return NextResponse.json({ error: "O nome da empresa é obrigatório." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", profile.company_id)
    .select("id,name,document,email,phone,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.rpc("log_audit", {
    p_action: "update",
    p_entity: "company",
    p_entity_id: data.id,
    p_details: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ company: data });
}
