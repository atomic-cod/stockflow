"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Operation={id:string;total:number;status:string;created_at:string;invoice_number?:string|null;notes?:string|null};

export default function Historico() {
  const [purchases,setPurchases]=useState<Operation[]>([]);
  const [sales,setSales]=useState<Operation[]>([]);
  const [tab,setTab]=useState<"purchases"|"sales">("purchases");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const [pr,sr]=await Promise.all([fetch("/api/compras"),fetch("/api/vendas")]);
    const [pd,sd]=await Promise.all([pr.json(),sr.json()]);
    if(pr.ok)setPurchases(pd.items??[]); else setError(pd.error??"Erro nas compras.");
    if(sr.ok)setSales(sd.items??[]); else setError(sd.error??"Erro nas vendas.");
  }
  useEffect(()=>{load()},[]);

  async function cancel(id:string,type:"compras"|"vendas"){
    if(!window.confirm("Cancelar esta operação e reverter o estoque?")) return;
    setError("");setMessage("");
    const r=await fetch("/api/"+type,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify(type==="compras"?{purchase_id:id}:{sale_id:id})});
    const d=await r.json();
    if(!r.ok){setError(d.error??"Não foi possível cancelar.");return}
    setMessage(d.message);load();
  }

  const items=tab==="purchases"?purchases:sales;
  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Histórico de operações</h1><p className="muted">Acompanhe compras e vendas e reverta operações quando necessário.</p></div></div>
    <div style={{display:"flex",gap:10,marginBottom:18}}>
      <button className={"btn "+(tab==="purchases"?"":"secondary")} onClick={()=>setTab("purchases")}>Compras</button>
      <button className={"btn "+(tab==="sales"?"":"secondary")} onClick={()=>setTab("sales")}>Vendas</button>
    </div>
    {error&&<p style={{color:"#b91c1c"}}>{error}</p>}{message&&<p style={{color:"#166534"}}>{message}</p>}
    <section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Identificação</th><th>Total</th><th>Status</th><th>Observação</th><th>Ação</th></tr></thead>
    <tbody>{items.map(item=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString("pt-BR")}</td><td>{tab==="purchases"?(item.invoice_number||item.id.slice(0,8)):"#" + item.id.slice(0,8)}</td><td>R$ {Number(item.total).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td>{item.status}</td><td>{item.notes||"—"}</td><td>{item.status!=="cancelled"&&<button className="btn secondary" onClick={()=>cancel(item.id,tab==="purchases"?"compras":"vendas")}>Cancelar</button>}</td></tr>)}
    {!items.length&&<tr><td colSpan={6}>Nenhuma operação encontrada.</td></tr>}</tbody></table></div></section>
  </main></div>;
}
