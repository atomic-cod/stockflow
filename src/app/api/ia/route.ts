import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const question = String(body.question ?? "").trim().toLowerCase();
  if (!question) return NextResponse.json({ error: "Digite uma pergunta." }, { status: 400 });

  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase.from("products").select("id,name,sku,stock_quantity,minimum_stock,maximum_stock,cost_price,sale_price,expiry_date,active").eq("active", true),
    supabase.from("stock_movements").select("type,quantity,created_at,products(name,sku)").order("created_at",{ascending:false}).limit(20)
  ]);

  const list = products ?? [];
  const low = list.filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock));
  const out = list.filter(p => Number(p.stock_quantity) <= 0);
  const value = list.reduce((sum,p) => sum + Number(p.stock_quantity) * Number(p.cost_price), 0);
  const now = new Date();
  const soon = new Date(now); soon.setDate(soon.getDate()+30);
  const expiring = list.filter(p => p.expiry_date && new Date(p.expiry_date+"T00:00:00") <= soon);

  let answer = "Posso consultar estoque baixo, produtos sem estoque, validade, valor do estoque e movimentações recentes.";
  if (question.includes("baixo") || question.includes("mínimo") || question.includes("minimo")) {
    answer = low.length
      ? "Há " + low.length + " produto(s) no estoque mínimo ou abaixo: " + low.slice(0,10).map(p=>p.name+" ("+p.stock_quantity+"/"+p.minimum_stock+")").join(", ") + "."
      : "Não há produtos no estoque mínimo ou abaixo neste momento.";
  } else if (question.includes("sem estoque") || question.includes("zerado") || question.includes("ruptura")) {
    answer = out.length ? "Há " + out.length + " produto(s) sem estoque: " + out.slice(0,10).map(p=>p.name).join(", ") + "." : "Nenhum produto está zerado no momento.";
  } else if (question.includes("valor") || question.includes("dinheiro") || question.includes("capital")) {
    answer = "O valor estimado do estoque pelo preço de custo é R$ " + value.toLocaleString("pt-BR",{minimumFractionDigits:2}) + ".";
  } else if (question.includes("validade") || question.includes("venc")) {
    answer = expiring.length ? "Há " + expiring.length + " produto(s) com validade nos próximos 30 dias: " + expiring.slice(0,10).map(p=>p.name+" ("+new Date(p.expiry_date+"T00:00:00").toLocaleDateString("pt-BR")+")").join(", ") + "." : "Não encontrei produtos com validade nos próximos 30 dias.";
  } else if (question.includes("movimenta") || question.includes("últimas") || question.includes("ultimas")) {
    answer = movements?.length
      ? "As últimas movimentações são: " +
        movements
          .slice(0, 8)
          .map((m) => {
            const products = m.products as unknown as { name?: string }[] | { name?: string } | null;
            const productName = Array.isArray(products) ? products[0]?.name : products?.name;
            return m.type + " — " + (productName || "produto") + " (" + m.quantity + ")";
          })
          .join("; ") +
        "."
      : "Ainda não existem movimentações registradas.";
  }

  return NextResponse.json({ answer, metrics: { products: list.length, low: low.length, out: out.length, expiring: expiring.length, stock_value: value } });
}
