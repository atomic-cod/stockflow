import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Relatorios() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: products } = await supabase.from("products").select("id,name,sku,stock_quantity,minimum_stock,cost_price,sale_price").eq("active",true).order("name");
  const { data: movements } = await supabase.from("stock_movements").select("id,type,quantity,previous_quantity,new_quantity,reason,created_at,products(name,sku)").order("created_at",{ascending:false}).limit(200);
  const stockValue = products?.reduce((s,p)=>s+Number(p.stock_quantity)*Number(p.cost_price),0) ?? 0;
  const low = products?.filter(p=>Number(p.stock_quantity)<=Number(p.minimum_stock)).length ?? 0;
  const margin = products?.reduce((s,p)=>s+Math.max(0,Number(p.sale_price)-Number(p.cost_price))*Number(p.stock_quantity),0) ?? 0;
  const productName = (products: unknown) => {
    const relation = products as { name?: string }[] | { name?: string } | null;
    return Array.isArray(relation) ? relation[0]?.name : relation?.name;
  };
  return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><h1 className="title">Relatórios</h1><p className="muted">Indicadores operacionais do estoque.</p></div></div>
    <section className="grid"><div className="card"><span className="muted">Valor em custo</span><div className="stat">R$ {stockValue.toFixed(2).replace(".",",")}</div></div><div className="card"><span className="muted">Estoque baixo</span><div className="stat">{low}</div></div><div className="card"><span className="muted">Margem potencial</span><div className="stat">R$ {margin.toFixed(2).replace(".",",")}</div></div><div className="card"><span className="muted">Movimentações</span><div className="stat">{movements?.length ?? 0}</div></div></section>
    <section className="section card"><h2>Histórico</h2><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Anterior</th><th>Novo</th><th>Motivo</th></tr></thead><tbody>{movements?.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString("pt-BR")}</td><td>{productName(m.products)}</td><td>{m.type}</td><td>{m.quantity}</td><td>{m.previous_quantity}</td><td>{m.new_quantity}</td><td>{m.reason||"—"}</td></tr>)}{!movements?.length&&<tr><td colSpan={7}>Nenhuma movimentação.</td></tr>}</tbody></table></div></section>
  </main></div>;
}