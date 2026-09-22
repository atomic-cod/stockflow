import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: members, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,created_at")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ members: members ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const userId = String(body.user_id ?? "");
  const role = String(body.role ?? "");
  if (!userId || !role) return NextResponse.json({ error: "Usuário e função são obrigatórios." }, { status: 400 });

  const { data, error } = await supabase.rpc("set_profile_role", {
    p_user_id: userId,
    p_role: role
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ member: data });
}
