"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";

const suggestions = [
  "Quais produtos estão com estoque baixo?",
  "Quais produtos estão sem estoque?",
  "Qual é o valor do meu estoque?",
  "Quais produtos estão perto da validade?",
  "Mostre as últimas movimentações."
];

export default function Assistente() {
  const [question,setQuestion]=useState("");
  const [answer,setAnswer]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function ask(value=question) {
    setError(""); setAnswer(""); setLoading(true);
    try {
      const r=await fetch("/api/ia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:value})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      setAnswer(d.answer);
    } catch(e:any) {
      setError(e.message ?? "Não foi possível consultar o assistente.");
    } finally { setLoading(false); }
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Assistente IA</h1><p className="muted">Consulte seus dados de estoque em linguagem natural.</p></div></div>
    <section className="card">
      <h2>O que você quer saber?</h2>
      <textarea className="input" rows={4} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ex.: quais produtos precisam de reposição?" />
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {suggestions.map(s=><button key={s} className="btn secondary" onClick={()=>{setQuestion(s);ask(s)}}>{s}</button>)}
      </div>
      <div style={{marginTop:18}}><button className="btn" disabled={loading} onClick={()=>ask()}>{loading?"Consultando...":"Perguntar"}</button></div>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}
      {answer && <div className="card" style={{marginTop:20,background:"#f8fafc"}}><b>Resposta</b><p>{answer}</p></div>}
    </section>
  </main></div>;
}
