"use client";
import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
export default function Configuracoes(){
 const [company,setCompany]=useState("Minha empresa"),[currency,setCurrency]=useState("BRL"),[saved,setSaved]=useState(false);
 return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><div className="eyebrow">WORKSPACE</div><h1 className="title">Configurações</h1><p className="muted">Preferências operacionais do StockFlow.</p></div></div>
 <section className="card section"><div className="panel-head"><div><div className="eyebrow">EMPRESA</div><h2>Identidade do workspace</h2></div></div><label>Nome da empresa<input className="input" value={company} onChange={e=>setCompany(e.target.value)}/></label><label>Moeda<select className="input" value={currency} onChange={e=>setCurrency(e.target.value)}><option value="BRL">BRL — Real brasileiro</option><option value="USD">USD — Dólar americano</option><option value="EUR">EUR — Euro</option></select></label><button className="btn" onClick={()=>setSaved(true)}>Salvar preferências</button>{saved&&<p className="muted">Preferências preparadas para persistência no workspace.</p>}</section>
 <section className="card section"><div className="eyebrow">PLATAFORMA</div><h2>StockFlow</h2><p className="muted">Controle de estoque, operações, alertas e inteligência em um só lugar.</p><div className="grid" style={{marginTop:16}}><div><span className="muted">Versão</span><strong style={{display:"block",marginTop:5}}>0.1.0</strong></div><div><span className="muted">Ambiente</span><strong style={{display:"block",marginTop:5}}>SaaS-ready</strong></div></div></section>
 </main></div>;
}