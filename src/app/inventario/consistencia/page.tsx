"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";

type Item = {
  product_id: string;
  product_name: string;
  global_quantity: number;
  warehouse_quantity: number;
  difference: number;
};

type Summary = {
  products: number;
  inconsistent: number;
  consistent: number;
};

export default function ConsistenciaEstoque() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary>({ products: 0, inconsistent: 0, consistent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/inventario/consistencia", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível verificar a consistência.");
        return;
      }

      setItems(data.items || []);
      setSummary(data.summary || { products: 0, inconsistent: 0, consistent: 0 });
    } catch {
      setError("Falha de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inconsistentItems = useMemo(
    () => items.filter((item) => Number(item.difference) !== 0),
    [items]
  );

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">CONTROLE DE INTEGRIDADE</div>
            <h1 className="title">Consistência de estoque</h1>
            <p className="muted">
              Compare o estoque global dos produtos com a soma dos saldos por depósito.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn secondary" href="/inventario">Inventário</Link>
            <button className="btn" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Verificando..." : "Verificar agora"}
            </button>
          </div>
        </div>

        {error && <div className="section card error-message">⚠ {error}</div>}

        <section className="kpi-grid section">
          <div className="card kpi-card">
            <span className="muted">Produtos analisados</span>
            <strong>{summary.products}</strong>
            <small>produtos ativos</small>
          </div>
          <div className="card kpi-card">
            <span className="muted">Consistentes</span>
            <strong>{summary.consistent}</strong>
            <small>sem diferença</small>
          </div>
          <div className="card kpi-card">
            <span className="muted">Divergentes</span>
            <strong>{summary.inconsistent}</strong>
            <small>exigem investigação</small>
          </div>
        </section>

        <section className="section card">
          <div className="panel-head">
            <div>
              <div className="eyebrow">STATUS</div>
              <h2>{summary.inconsistent === 0 ? "Estoque sincronizado" : "Existem divergências"}</h2>
              <p className="muted">
                {summary.inconsistent === 0
                  ? "O saldo global está igual à soma dos saldos por depósito."
                  : "Revise os produtos abaixo antes de realizar ajustes manuais."}
              </p>
            </div>
            {summary.inconsistent === 0 ? (
              <CheckCircle2 size={30} />
            ) : (
              <ShieldAlert size={30} />
            )}
          </div>
        </section>

        <section className="section card">
          <div className="panel-head">
            <div>
              <div className="eyebrow">DETALHAMENTO</div>
              <h2>Produtos com divergência</h2>
            </div>
            <span className="muted">{inconsistentItems.length} item(ns)</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque global</th>
                  <th>Por depósitos</th>
                  <th>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {inconsistentItems.map((item) => (
                  <tr key={item.product_id}>
                    <td><b>{item.product_name}</b></td>
                    <td>{item.global_quantity}</td>
                    <td>{item.warehouse_quantity}</td>
                    <td><strong>{item.difference > 0 ? "+" : ""}{item.difference}</strong></td>
                  </tr>
                ))}
                {!loading && inconsistentItems.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 28 }}>
                      <span className="muted">Nenhuma divergência encontrada.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
