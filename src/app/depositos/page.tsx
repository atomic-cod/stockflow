"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Warehouse = { id: string; name: string; code: string; address?: string | null; active: boolean };

export default function Depositos() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const r = await fetch("/api/depositos");
    const d = await r.json();
    if (r.ok) setItems(d.warehouses ?? []);
    else setError(d.error ?? "Não foi possível carregar os depósitos.");
  }

  useEffect(() => { load(); }, []);

  async function create() {
    setError(""); setMessage("");
    const r = await fetch("/api/depositos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, address })
    });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Não foi possível criar o depósito.");
    setItems(current => [...current, d.warehouse].sort((a,b) => a.name.localeCompare(b.name)));
    setName(""); setCode(""); setAddress("");
    setMessage("Depósito criado com sucesso.");
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar">
      <div><h1 className="title">Depósitos</h1><p className="muted">Organize estoques por local físico.</p></div>
    </div>

    <section className="card">
      <h2>Novo depósito</h2>
      <div className="form-grid">
        <label>Nome<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Centro de Distribuição" /></label>
        <label>Código<input className="input" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ex.: CD01" /></label>
        <label>Endereço<input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número, cidade..." /></label>
      </div>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}
      {message && <p style={{color:"#166534"}}>{message}</p>}
      <button className="btn" onClick={create}>Adicionar depósito</button>
    </section>

    <section className="section card">
      <h2>Depósitos ativos</h2>
      <div className="table-wrap"><table className="table"><thead><tr><th>Nome</th><th>Código</th><th>Endereço</th><th>Status</th></tr></thead>
      <tbody>{items.map(item=><tr key={item.id}><td><b>{item.name}</b></td><td>{item.code}</td><td>{item.address || "—"}</td><td>Ativo</td></tr>)}
      {!items.length && <tr><td colSpan={4}>Nenhum depósito cadastrado.</td></tr>}</tbody></table></div>
    </section>
  </main></div>;
}
