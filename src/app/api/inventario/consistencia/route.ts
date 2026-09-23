import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  if (!["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso restrito a administradores e gestores." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("get_stock_consistency");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items = data ?? [];
  const inconsistent = items.filter((item: { difference: number | string }) => Number(item.difference) !== 0);

  return NextResponse.json({
    items,
    summary: {
      products: items.length,
      inconsistent: inconsistent.length,
      consistent: items.length - inconsistent.length,
    },
  });
}
