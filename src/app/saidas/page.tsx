"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";

type Product = { id: string; name: string; sku: string; stock_quantity: number };

export default function Saidas() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState("sale");
  const [reason, setReason] = useState("Venda");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/produtos").then(r => r.json()).then(d => setProducts(d.products ?? []));
  }, []);

  async function submit() {
    setError(""); setMessage("");
    const response = await fetch("/api/movimentacoes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, type, quantity, reason })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Erro ao registrar saída.");
    else { setMessage("Saída registrada e estoque atualizado."); setQuantity(""); }
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Saídas</h1><p className="muted">Registre vendas, perdas e danos.</p></div><Link className="btn" href="/produtos">Ver produtos</Link></div>
    <section className="section card">
      <label>Produto<select className="input" value={productId} onChange={e => setProductId(e.target.value)}><option value="">Selecione...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku} (estoque: {p.stock_quantity})</option>)}</select></label>
      <label>Tipo<select className="input" value={type} onChange={e => {setType(e.target.value);setReason(e.target.value === "sale" ? "Venda" : e.target.value === "loss" ? "Perda" : "Dano")}}><option value="sale">Venda</option><option value="loss">Perda</option><option value="damage">Dano</option><option value="transfer_out">Transferência</option></select></label>
      <label>Quantidade<input className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label>Motivo<input className="input" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}{message && <p style={{color:"#166534"}}>{message}</p>}
      <button className="btn" onClick={submit}>Registrar saída</button>
    </section>
  </main></div>;
}
