"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Company = {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
};

export default function Configuracoes() {
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/configuracoes", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar as configurações.");
        setCompany(data.company);
        setRole(data.role || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar configurações."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!company) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");

      setCompany(data.company);
      setMessage("Configurações salvas com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar configurações.");
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
            <div className="eyebrow">WORKSPACE</div>
            <h1 className="title">Configurações</h1>
            <p className="muted">Gerencie a identidade e as preferências operacionais da empresa.</p>
          </div>
        </div>

        {loading && <div className="card">Carregando configurações...</div>}
        {error && <div className="section card error-message">⚠ {error}</div>}
        {message && <div className="section card success-message">✓ {message}</div>}

        {company && (
          <>
            <section className="card section">
              <div className="panel-head">
                <div><div className="eyebrow">EMPRESA</div><h2>Identidade do workspace</h2></div>
                <span className="role-badge">{role || "usuário"}</span>
              </div>

              <div className="form-grid">
                <label>Nome da empresa<input className="input" value={company.name || ""} onChange={(e) => setCompany({ ...company, name: e.target.value })} disabled={role !== "admin"} /></label>
                <label>Documento<input className="input" value={company.document || ""} onChange={(e) => setCompany({ ...company, document: e.target.value })} disabled={role !== "admin"} placeholder="CNPJ / CPF" /></label>
                <label>E-mail<input className="input" type="email" value={company.email || ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} disabled={role !== "admin"} /></label>
                <label>Telefone<input className="input" value={company.phone || ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} disabled={role !== "admin"} placeholder="(11) 99999-9999" /></label>
              </div>

              <button className="btn" onClick={save} disabled={saving || role !== "admin"}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>

              {role !== "admin" && <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Somente administradores podem alterar os dados da empresa.</p>}
            </section>

            <section className="card section">
              <div className="panel-head">
                <div><div className="eyebrow">PREFERÊNCIAS</div><h2>Operação</h2></div>
              </div>
              <label>Moeda padrão<select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="BRL">BRL — Real brasileiro</option><option value="USD">USD — Dólar americano</option><option value="EUR">EUR — Euro</option></select></label>
              <p className="muted" style={{ fontSize: 12 }}>A moeda é mantida como preferência local nesta versão. A persistência global será adicionada ao módulo de billing/configuração SaaS.</p>
            </section>

            <section className="card section">
              <div className="eyebrow">PLATAFORMA</div>
              <h2>StockFlow</h2>
              <p className="muted">Controle de estoque, operações, alertas, auditoria e inteligência em um só lugar.</p>
              <div className="grid" style={{ marginTop: 16 }}>
                <div><span className="muted">Versão</span><strong style={{ display: "block", marginTop: 5 }}>0.1.0</strong></div>
                <div><span className="muted">Perfil atual</span><strong style={{ display: "block", marginTop: 5, textTransform: "capitalize" }}>{role || "—"}</strong></div>
                <div><span className="muted">Arquitetura</span><strong style={{ display: "block", marginTop: 5 }}>Multiempresa</strong></div>
                <div><span className="muted">Status</span><strong style={{ display: "block", marginTop: 5 }}>SaaS-ready</strong></div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
