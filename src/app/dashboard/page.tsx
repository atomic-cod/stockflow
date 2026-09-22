import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={d} /></svg>
);

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase.from("products").select("id,name,sku,stock_quantity,minimum_stock,cost_price,sale_price,expiry_date,location").eq("active", true);
  const { data: movements } = await supabase.from("stock_movements").select("id,type,quantity,new_quantity,reason,created_at,products(name,sku)").order("created_at", { ascending: false }).limit(8);

  const totalValue = (products ?? []).reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
  const salesValue = (products ?? []).reduce((s, p) => s + Number(p.stock_quantity) * Number(p.sale_price), 0);
  const low = (products ?? []).filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock));
  const expiry = (products ?? []).filter(p => p.expiry_date && new Date(p.expiry_date + "T00:00:00").getTime() <= Date.now() + 30 * 86400000);
  const units = (products ?? []).reduce((s, p) => s + Number(p.stock_quantity), 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data: mm } = await supabase.from("stock_movements").select("type,quantity").gte("created_at", monthStart.toISOString());
  const entries = (mm ?? []).filter(m => ["purchase","return","transfer_in","adjustment_in"].includes(m.type)).reduce((s,m) => s + Number(m.quantity), 0);
  const exits = (mm ?? []).filter(m => ["sale","loss","damage","transfer_out","adjustment_out"].includes(m.type)).reduce((s,m) => s + Number(m.quantity), 0);
  const typeLabel: Record<string,string> = { purchase:"Compra",sale:"Venda",loss:"Perda",damage:"Avaria",return:"Devolução",transfer_in:"Entrada",transfer_out:"Saída",adjustment_in:"Ajuste +",adjustment_out:"Ajuste -" };
  const marginValue = salesValue - totalValue;
  const lowPercent = products?.length ? Math.round((low.length / products.length) * 100) : 0;

  return <div className="shell">
    <Sidebar />
    <main className="main dashboard-main">
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow"><span className="pulse-dot" /> OPERAÇÃO EM TEMPO REAL</div>
          <h1 className="title">Olá, bem-vindo ao <span>StockFlow</span></h1>
          <p className="muted">Controle seu estoque, acompanhe movimentações e encontre gargalos em segundos.</p>
        </div>
        <div className="hero-actions">
          <Link className="btn secondary" href="/scanner"><Icon d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 12h8M12 8v8" /> Escanear</Link>
          <Link className="btn" href="/compras">+ Nova operação</Link>
        </div>
      </div>

      <section className="dashboard-kpis">
        <div className="dash-kpi cyan"><div className="kpi-icon"><Icon d="M4 6h16v13H4zM8 10h8M8 14h5" /></div><div><span>Produtos ativos</span><strong>{products?.length ?? 0}</strong><small>Catálogo operacional</small></div></div>
        <div className="dash-kpi violet"><div className="kpi-icon"><Icon d="M12 3v18M7 7h10M6 17h12" /></div><div><span>Unidades em estoque</span><strong>{units.toLocaleString("pt-BR")}</strong><small>Quantidade disponível</small></div></div>
        <div className="dash-kpi green"><div className="kpi-icon"><Icon d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" /></div><div><span>Valor do estoque</span><strong>R$ {totalValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><small>Preço de custo</small></div></div>
        <div className="dash-kpi amber"><div className="kpi-icon"><Icon d="M4 17l5-5 4 3 7-8M16 7h4v4" /></div><div><span>Valor potencial</span><strong>R$ {salesValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><small>Margem potencial: R$ {marginValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</small></div></div>
      </section>

      <section className="dashboard-layout section">
        <div className="dash-panel performance-panel">
          <div className="panel-head"><div><span className="eyebrow">FLUXO DO MÊS</span><h2>Movimentação de estoque</h2></div><Link href="/relatorios" className="panel-link">Ver relatórios →</Link></div>
          <div className="flow-metrics">
            <div><span className="flow-label"><i className="flow-in" /> Entradas</span><strong>+{entries.toLocaleString("pt-BR")}</strong><small>unidades</small></div>
            <div><span className="flow-label"><i className="flow-out" /> Saídas</span><strong>-{exits.toLocaleString("pt-BR")}</strong><small>unidades</small></div>
            <div><span className="flow-label">Saldo operacional</span><strong>{(entries-exits).toLocaleString("pt-BR")}</strong><small>unidades</small></div>
          </div>
          <div className="flow-track"><span style={{width: entries + exits ? Math.min(100, Math.round(entries/(entries+exits)*100)) + "%" : "0%"}} /></div>
          <div className="flow-foot"><span>Entradas representam {entries + exits ? Math.round(entries/(entries+exits)*100) : 0}% do fluxo</span><span>Este mês</span></div>
        </div>

        <div className="dash-panel alert-panel">
          <div className="panel-head"><div><span className="eyebrow">MONITORAMENTO</span><h2>Central de alertas</h2></div></div>
          <Link href="/produtos" className="alert-row"><div className="alert-symbol danger">!</div><div><b>Estoque baixo</b><span>{low.length} produto(s) precisam de atenção</span></div><strong>{lowPercent}%</strong></Link>
          <Link href="/relatorios" className="alert-row"><div className="alert-symbol warning">◷</div><div><b>Validade próxima</b><span>Próximos 30 dias</span></div><strong>{expiry.length}</strong></Link>
          <Link href="/historico" className="alert-row"><div className="alert-symbol info">↗</div><div><b>Atividade recente</b><span>Últimas movimentações</span></div><strong>{movements?.length ?? 0}</strong></Link>
        </div>
      </section>

      <section className="dashboard-layout section">
        <div className="dash-panel">
          <div className="panel-head"><div><span className="eyebrow">INVENTÁRIO</span><h2>Itens que exigem atenção</h2></div><Link href="/produtos" className="panel-link">Abrir catálogo →</Link></div>
          <div className="table-wrap futuristic-table"><table className="table"><thead><tr><th>Produto</th><th>SKU</th><th>Estoque</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>
            {low.slice(0,6).map(p => <tr key={p.id}><td><b>{p.name}</b><small>{p.location || "Local não definido"}</small></td><td>{p.sku}</td><td><strong>{p.stock_quantity}</strong></td><td>{p.minimum_stock}</td><td><span className="status danger">REPOR</span></td></tr>)}
            {!low.length && <tr><td colSpan={5}><div className="empty-state">✓ Nenhum produto abaixo do estoque mínimo.</div></td></tr>}
          </tbody></table></div>
        </div>

        <div className="dash-panel activity-panel">
          <div className="panel-head"><div><span className="eyebrow">LIVE FEED</span><h2>Atividade recente</h2></div><Link href="/historico" className="panel-link">Ver tudo →</Link></div>
          <div className="activity-list">{movements?.map((m:any) => <div className="activity-item" key={m.id}><div className={"activity-icon " + (m.type === "sale" ? "sale" : "entry")}>{m.type === "sale" ? "↗" : "↙"}</div><div className="activity-copy"><b>{Array.isArray(m.products) ? m.products[0]?.name : m.products?.name}</b><span>{typeLabel[m.type] ?? m.type} · {m.quantity} un.</span></div><time>{new Date(m.created_at).toLocaleDateString("pt-BR")}</time></div>)}{!movements?.length && <div className="empty-state">Nenhuma movimentação registrada.</div>}</div>
        </div>
      </section>
    </main>
  </div>;
}
