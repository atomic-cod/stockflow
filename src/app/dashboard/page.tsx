import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Dashboard(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:products}=await supabase.from("products").select("id,name,sku,stock_quantity,minimum_stock,cost_price,sale_price,expiry_date,location").eq("active",true);
  const {data:movements}=await supabase.from("stock_movements").select("id,type,quantity,new_quantity,reason,created_at,products(name,sku)").order("created_at",{ascending:false}).limit(10);
  const totalValue=(products??[]).reduce((s,p)=>s+Number(p.stock_quantity)*Number(p.cost_price),0);
  const salesValue=(products??[]).reduce((s,p)=>s+Number(p.stock_quantity)*Number(p.sale_price),0);
  const low=(products??[]).filter(p=>Number(p.stock_quantity)<=Number(p.minimum_stock));
  const expiry=(products??[]).filter(p=>p.expiry_date&&new Date(p.expiry_date+"T00:00:00").getTime()<=Date.now()+30*86400000);
  const units=(products??[]).reduce((s,p)=>s+Number(p.stock_quantity),0);
  const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);
  const {data:mm}=await supabase.from("stock_movements").select("type,quantity").gte("created_at",monthStart.toISOString());
  const entries=(mm??[]).filter(m=>["purchase","return","transfer_in","adjustment_in"].includes(m.type)).reduce((s,m)=>s+Number(m.quantity),0);
  const exits=(mm??[]).filter(m=>["sale","loss","damage","transfer_out","adjustment_out"].includes(m.type)).reduce((s,m)=>s+Number(m.quantity),0);
  const typeLabel:any={purchase:"Compra",sale:"Venda",loss:"Perda",damage:"Avaria",return:"Devolução",transfer_in:"Transferência +",transfer_out:"Transferência -",adjustment_in:"Ajuste +",adjustment_out:"Ajuste -"};

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Dashboard</h1><p className="muted">Visão operacional do seu estoque em tempo real.</p></div><div style={{display:"flex",gap:10}}><Link className="btn secondary" href="/compras">Nova compra</Link><Link className="btn" href="/vendas">Nova venda</Link></div></div>
    <section className="grid">
      <div className="card"><span className="muted">Produtos ativos</span><div className="stat">{products?.length??0}</div></div>
      <div className="card"><span className="muted">Unidades</span><div className="stat">{units.toLocaleString("pt-BR")}</div></div>
      <div className="card"><span className="muted">Custo do estoque</span><div className="stat">R$ {totalValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</div></div>
      <div className="card"><span className="muted">Valor potencial de venda</span><div className="stat">R$ {salesValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</div></div>
    </section>
    <section className="grid section">
      <div className="card"><span className="muted">Entradas no mês</span><div className="stat">{entries.toLocaleString("pt-BR")}</div></div>
      <div className="card"><span className="muted">Saídas no mês</span><div className="stat">{exits.toLocaleString("pt-BR")}</div></div>
      <Link className="card" href="/produtos"><b>Estoque baixo</b><div className="stat">{low.length}</div><p className="muted">Produtos que precisam de reposição.</p></Link>
      <Link className="card" href="/relatorios"><b>Validade</b><div className="stat">{expiry.length}</div><p className="muted">Vencendo nos próximos 30 dias.</p></Link>
    </section>
    <section className="section card"><div className="topbar" style={{marginBottom:12}}><div><h2>Alertas de estoque</h2><p className="muted">Itens abaixo ou no estoque mínimo.</p></div><Link className="btn secondary" href="/produtos">Ver produtos</Link></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>SKU</th><th>Atual</th><th>Mínimo</th><th>Local</th></tr></thead><tbody>{low.slice(0,8).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td><b>{p.stock_quantity}</b></td><td>{p.minimum_stock}</td><td>{p.location||"—"}</td></tr>)}{!low.length&&<tr><td colSpan={5}>Nenhum produto em estoque baixo.</td></tr>}</tbody></table></div>
    </section>
    <section className="section card"><h2>Últimas movimentações</h2><div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Após</th><th>Data</th></tr></thead><tbody>{movements?.map((m:any)=><tr key={m.id}><td>{Array.isArray(m.products)?m.products[0]?.name:m.products?.name}</td><td>{typeLabel[m.type]??m.type}</td><td>{m.quantity}</td><td>{m.new_quantity}</td><td>{new Date(m.created_at).toLocaleString("pt-BR")}</td></tr>)}{!movements?.length&&<tr><td colSpan={5}>Nenhuma movimentação registrada.</td></tr>}</tbody></table></div></section>
  </main></div>;
}
