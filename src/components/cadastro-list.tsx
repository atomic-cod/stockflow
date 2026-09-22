"use client";

import { FormEvent, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Field = { key: string; label: string; type?: string };

export function CadastroList({ entity, title, description, fields }: {
  entity: "fornecedores" | "clientes" | "categorias";
  title: string;
  description: string;
  fields: Field[];
}) {
  const [items,setItems]=useState<any[]>([]);
  const [form,setForm]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load() {
    const r=await fetch(`/api/cadastros/${entity}`);
    const d=await r.json();
    if(r.ok) setItems(d.items ?? []);
    else setError(d.error ?? "Não foi possível carregar.");
  }
  useEffect(()=>{load()},[]);

  async function submit(e:FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    const r=await fetch(`/api/cadastros/${entity}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const d=await r.json();
    if(!r.ok) setError(d.error ?? "Erro ao salvar.");
    else { setMessage("Cadastro salvo com sucesso."); setForm({}); await load(); }
    setLoading(false);
  }

  async function remove(id:string) {
    if(!window.confirm("Excluir este cadastro?")) return;
    const r=await fetch(`/api/cadastros/${entity}?id=${id}`,{method:"DELETE"});
    const d=await r.json();
    if(!r.ok) setError(d.error ?? "Não foi possível excluir.");
    else await load();
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">{title}</h1><p className="muted">{description}</p></div></div>
    <section className="section card">
      <h2>Novo cadastro</h2>
      <form onSubmit={submit}>
        <div className="form-grid">{fields.map(f=><label key={f.key}>{f.label}<input className="input" type={f.type ?? "text"} value={form[f.key] ?? ""} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))} required={f.key==="name"} /></label>)}</div>
        {error && <p style={{color:"#b91c1c"}}>{error}</p>}
        {message && <p style={{color:"#166534"}}>{message}</p>}
        <button className="btn" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
      </form>
    </section>
    <section className="section card"><h2>Cadastros</h2><div className="table-wrap"><table className="table"><thead><tr>{fields.map(f=><th key={f.key}>{f.label}</th>)}<th>Ações</th></tr></thead><tbody>{items.map(item=><tr key={item.id}>{fields.map(f=><td key={f.key}>{item[f.key] || "—"}</td>)}<td><button className="btn secondary" onClick={()=>remove(item.id)}>Excluir</button></td></tr>)}{!items.length&&<tr><td colSpan={fields.length+1}>Nenhum cadastro encontrado.</td></tr>}</tbody></table></div></section>
  </main></div>;
}
