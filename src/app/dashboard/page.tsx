import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase.from("products")
    .select("id,name,stock_quantity,minimum_stock,cost_price,sale_price").eq("active", true);

  const { data: movements } = await supabase.from("stock_movements")
    .select("id,type,quantity,new_quantity,reason,created_at,products(name,sku)")
    .order("created_at", { ascending: false }).limit(8);

  const totalStockValue = products?.reduce((sum,p) => sum + Number(p.stock_quantity) * Number(p.cost_price), 0) ?? 0;
  const lowStock = products?.filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock)).length ?? 0;
  const totalUnits = products?.reduce((sum,p) => sum + Number(p.stock_quantity), 0) ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: monthMovements } = await supabase.from("stock_movements")
    .select("type,quantity").gte("created_at", monthStart);

  const entries = monthMovements?.filter(m => ["purchase","return","transfer_in"].includes(m.type)).reduce((s,m)=>s+Number(m.quantity),0) ?? 0;
  const exits = monthMovements?.filter(m => ["sale","loss","damage","transfer_out"].includes(m.type)).reduce((s,m)=>s+Number(m.quantity),0) ?? 0;

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Dashboard</h1><p className="muted">Visão geral do seu estoque.</p></div><Link className="btn" href="/entradas">+ Movimento</Link></div>
    <section className="grid">
      <div className="card"><span className="muted">Produtos ativos</span><div className="stat">{products?.length ?? 0}</div></div>
      <div className="card"><span className="muted">Unidades em estoque</span><div className="stat">{totalUnits.toLocaleString("pt-BR")}</div></div>
      <div className="card"><span className="muted">Valor do estoque</span><div className="stat">R$ {totalStockValue.toFixed(2).replace(".",",")}</div></div>
      <div className="card"><span className="muted">Estoque baixo</span><div className="stat">{lowStock}</div></div>
    </section>
    <section className="grid section">
      <div className="card"><span className="muted">Entradas no mês</span><div className="stat">{entries.toLocaleString("pt-BR")}</div></div>
      <div className="card"><span className="muted">Saídas no mês</span><div className="stat">{exits.toLocaleString("pt-BR")}</div></div>
      <Link href="/produtos" className="card"><b>Produtos</b><p className="muted">Catálogo, preços e estoque.</p></Link>
      <Link href="/relatorios" className="card"><b>Relatórios</b><p className="muted">Movimentações e indicadores.</p></Link>
    </section>
    <section className="section card"><h2>Últimas movimentações</h2><div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Estoque após</th><th>Data</th></tr></thead><tbody>
      {movements?.map(m => <tr key={m.id}><td>{Array.isArray(m.products) ? m.products[0]?.name : m.products?.name}</td><td>{m.type}</td><td>{m.quantity}</td><td>{m.new_quantity}</td><td>{new Date(m.created_at).toLocaleString("pt-BR")}</td></tr>)}
      {!movements?.length && <tr><td colSpan={5}>Nenhuma movimentação registrada.</td></tr>}
    </tbody></table></div></section>
  </main></div>;
}
