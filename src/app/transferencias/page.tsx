"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Warehouse = { id: string; name: string; code: string };
type Product = { id: string; name: string; sku: string; stock_quantity: number };
type StockItem = { warehouse_id: string; warehouse_name: string; warehouse_code: string; quantity: number };

export default function Transferencias() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([
        fetch("/api/transferencias", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/produtos", { cache: "no-store" }).then(r => r.json()),
      ]);
      setWarehouses(w.warehouses ?? []);
      setProducts(p.products ?? []);
      setFromId(current => current || w.warehouses?.[0]?.id || "");
      setToId(current => current || w.warehouses?.[1]?.id || "");
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStock(id: string) {
    if (!id) { setStock([]); return; }
    const response = await fetch("/api/transferencias?product_id=" + encodeURIComponent(id), { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setStock(data.items ?? []);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStock(productId); }, [productId]);

  const originStock = useMemo(
    () => Number(stock.find(item => item.warehouse_id === fromId)?.quantity ?? 0),
    [stock, fromId]
  );

  async function submit() {
    setError("");
    setMessage("");
    const amount = Number(quantity);
    if (!productId || !fromId || !toId || fromId === toId || !Number.isFinite(amount) || amount <= 0) {
      setError("Selecione produto, origem, destino diferente e uma quantidade válida.");
      return;
    }
    if (amount > originStock) {
      setError("A quantidade é maior que o estoque disponível no depósito de origem.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          quantity: amount,
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível realizar a transferência.");
      setMessage("Transferência realizada com sucesso.");
      setQuantity("1");
      setNotes("");
      await loadStock(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na transferência.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">LOGÍSTICA INTERNA</div>
            <h1 className="title">Transferências</h1>
            <p className="muted">Movimente produtos entre depósitos com controle de estoque.</p>
          </div>
        </div>

        <section className="grid">
          <div className="card"><span className="muted">Depósitos ativos</span><div className="stat">{warehouses.length}</div></div>
          <div className="card"><span className="muted">Produto selecionado</span><div className="stat">{productId ? "SIM" : "—"}</div></div>
          <div className="card"><span className="muted">Disponível na origem</span><div className="stat">{originStock}</div></div>
        </section>

        <section className="card section">
          <div className="eyebrow">NOVA TRANSFERÊNCIA</div>
          <div className="form-grid">
            <label>Produto
              <select className="input" value={productId} onChange={e => setProductId(e.target.value)}>
                <option value="">Selecione...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
              </select>
            </label>
            <label>Quantidade
              <input className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </label>
          </div>
          <div className="form-grid">
            <label>Origem
              <select className="input" value={fromId} onChange={e => setFromId(e.target.value)}>
                <option value="">Selecione...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </label>
            <label>Destino
              <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
                <option value="">Selecione...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </label>
          </div>
          <label>Observações
            <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motivo ou observação da transferência..." />
          </label>
          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
          <button className="btn" onClick={submit} disabled={saving || loading}>{saving ? "Transferindo..." : "Confirmar transferência"}</button>
        </section>

        {productId && (
          <section className="card section">
            <div className="panel-head">
              <div><div className="eyebrow">DISTRIBUIÇÃO</div><h2>Estoque por depósito</h2></div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Depósito</th><th>Código</th><th>Quantidade</th></tr></thead>
                <tbody>
                  {stock.map(item => (
                    <tr key={item.warehouse_id}>
                      <td><b>{item.warehouse_name}</b></td>
                      <td><span className="code-chip">{item.warehouse_code}</span></td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                  {!stock.length && <tr><td colSpan={3}>Nenhum estoque distribuído.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
