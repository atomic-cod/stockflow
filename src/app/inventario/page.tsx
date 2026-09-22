"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Product = { id: string; name: string; sku: string; stock_quantity: number; unit?: string };
type Count = { id: string; expected_quantity: number; counted_quantity: number; difference: number; notes?: string | null; created_at: string; products?: Product | Product[] | null };

export default function Inventario() {
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Count[]>([]);
  const [productId, setProductId] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [productsResponse, countsResponse] = await Promise.all([
      fetch("/api/produtos"),
      fetch("/api/inventario")
    ]);
    const productsData = await productsResponse.json();
    const countsData = await countsResponse.json();
    if (productsResponse.ok) setProducts(productsData.products ?? []);
    if (countsResponse.ok) setCounts(countsData.counts ?? []);
    if (!countsResponse.ok) setError(countsData.error ?? "Não foi possível carregar o inventário.");
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setError(""); setMessage("");
    const r = await fetch("/api/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, counted_quantity: counted, notes })
    });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Não foi possível concluir a contagem.");
    setMessage("Contagem concluída e estoque ajustado.");
    setProductId(""); setCounted(""); setNotes("");
    load();
  }

  const selected = products.find(p=>p.id===productId);

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Inventário físico</h1><p className="muted">Compare o estoque do sistema com a contagem real.</p></div></div>

    <section className="card">
      <h2>Nova contagem</h2>
      <label>Produto<select className="input" value={productId} onChange={e=>{setProductId(e.target.value);setCounted("");}}>
        <option value="">Selecione...</option>
        {products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.sku} (sistema: {p.stock_quantity} {p.unit||"UN"})</option>)}
      </select></label>
      {selected && <p className="muted">Estoque atual: <b>{selected.stock_quantity} {selected.unit||"UN"}</b></p>}
      <label>Quantidade encontrada<input className="input" type="number" min="0" step="0.001" value={counted} onChange={e=>setCounted(e.target.value)} /></label>
      <label>Observação<input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: caixa danificada, contagem dupla..." /></label>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}
      {message && <p style={{color:"#166534"}}>{message}</p>}
      <button className="btn" onClick={submit}>Concluir contagem</button>
    </section>

    <section className="section card"><h2>Últimas contagens</h2><div className="table-wrap"><table className="table">
      <thead><tr><th>Data</th><th>Produto</th><th>Sistema</th><th>Contado</th><th>Diferença</th><th>Observação</th></tr></thead>
      <tbody>{counts.map(c=>{const p=Array.isArray(c.products)?c.products[0]:c.products; return <tr key={c.id}><td>{new Date(c.created_at).toLocaleString("pt-BR")}</td><td>{p?.name||"—"}</td><td>{c.expected_quantity}</td><td>{c.counted_quantity}</td><td><b>{c.difference > 0 ? "+" : ""}{c.difference}</b></td><td>{c.notes||"—"}</td></tr>})}
      {!counts.length&&<tr><td colSpan={6}>Nenhuma contagem registrada.</td></tr>}</tbody></table></div></section>
  </main></div>;
}
