import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Alertas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("products")
    .select("id,name,sku,stock_quantity,minimum_stock,maximum_stock,expiry_date,active")
    .eq("active", true)
    .order("name");

  const now = new Date();
  const inThirtyDays = new Date(now);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  const low = (products ?? []).filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock));
  const expiring = (products ?? []).filter(p => {
    if (!p.expiry_date) return false;
    const date = new Date(p.expiry_date + "T00:00:00");
    return date <= inThirtyDays;
  });
  const outOfStock = (products ?? []).filter(p => Number(p.stock_quantity) <= 0);

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Alertas</h1><p className="muted">Itens que precisam de atenção operacional.</p></div></div>

    <section className="grid">
      <div className="card"><span className="muted">Sem estoque</span><div className="stat">{outOfStock.length}</div></div>
      <div className="card"><span className="muted">Estoque baixo</span><div className="stat">{low.length}</div></div>
      <div className="card"><span className="muted">Validade em até 30 dias</span><div className="stat">{expiring.length}</div></div>
    </section>

    <section className="section card"><h2>Estoque crítico</h2><div className="table-wrap"><table className="table">
      <thead><tr><th>Produto</th><th>SKU</th><th>Atual</th><th>Mínimo</th><th>Máximo</th><th>Ação</th></tr></thead>
      <tbody>{low.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.stock_quantity}</td><td>{p.minimum_stock}</td><td>{p.maximum_stock ?? "—"}</td><td><Link className="btn secondary" href={"/produtos/"+p.id}>Abrir</Link></td></tr>)}{!low.length&&<tr><td colSpan={6}>Nenhum item abaixo do mínimo.</td></tr>}</tbody>
    </table></div></section>

    <section className="section card"><h2>Validade próxima</h2><div className="table-wrap"><table className="table">
      <thead><tr><th>Produto</th><th>SKU</th><th>Validade</th><th>Estoque</th></tr></thead>
      <tbody>{expiring.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.expiry_date ? new Date(p.expiry_date+"T00:00:00").toLocaleDateString("pt-BR") : "—"}</td><td>{p.stock_quantity}</td></tr>)}{!expiring.length&&<tr><td colSpan={4}>Nenhuma validade próxima.</td></tr>}</tbody>
    </table></div></section>
  </main></div>;
}
