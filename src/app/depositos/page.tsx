"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  active: boolean;
};

export default function Depositos() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/depositos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os depósitos.");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar depósitos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim() || !code.trim()) {
      setError("Informe o nome e o código do depósito.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/depositos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o depósito.");

      setItems((current) => [...current, data.item]);
      setName("");
      setCode("");
      setAddress("");
      setMessage("Depósito criado com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar depósito.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Warehouse) {
    setError("");
    const response = await fetch("/api/depositos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Não foi possível atualizar o depósito.");
      return;
    }

    setItems((current) => current.map((warehouse) =>
      warehouse.id === item.id ? data.item : warehouse
    ));
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">ESTRUTURA LOGÍSTICA</div>
            <h1 className="title">Depósitos</h1>
            <p className="muted">Organize centros de estoque, endereços e operações.</p>
          </div>
        </div>

        <section className="grid">
          <div className="card"><span className="muted">Depósitos</span><div className="stat">{items.length}</div></div>
          <div className="card"><span className="muted">Ativos</span><div className="stat">{items.filter((item) => item.active).length}</div></div>
          <div className="card"><span className="muted">Códigos cadastrados</span><div className="stat">{new Set(items.map((item) => item.code)).size}</div></div>
        </section>

        <section className="card section">
          <div className="panel-head">
            <div>
              <div className="eyebrow">NOVO DEPÓSITO</div>
              <h2>Adicionar unidade</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>Nome<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Centro de distribuição" /></label>
            <label>Código<input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: CD01" maxLength={20} /></label>
          </div>
          <label>Endereço<input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, cidade..." /></label>
          <button className="btn" onClick={add} disabled={saving}>{saving ? "Salvando..." : "Adicionar depósito"}</button>
        </section>

        {message && <div className="section card success-message">✓ {message}</div>}
        {error && <div className="section card error-message">⚠ {error}</div>}

        <section className="card section">
          <div className="panel-head">
            <div><div className="eyebrow">CADASTRO</div><h2>Unidades logísticas</h2></div>
            <span className="muted">{items.length} registro(s)</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Depósito</th><th>Código</th><th>Endereço</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5}>Carregando depósitos...</td></tr>}
                {!loading && items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b></td>
                    <td><span className="code-chip">{item.code}</span></td>
                    <td>{item.address || "—"}</td>
                    <td><span className={item.active ? "status success" : "status"}>{item.active ? "ATIVO" : "INATIVO"}</span></td>
                    <td><button className="btn secondary" onClick={() => toggle(item)}>{item.active ? "Desativar" : "Ativar"}</button></td>
                  </tr>
                ))}
                {!loading && !items.length && <tr><td colSpan={5}><div className="empty-state">Nenhum depósito cadastrado.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
