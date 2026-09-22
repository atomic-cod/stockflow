"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Member = { id:string; full_name:string; role:string; created_at:string };
const roles = [
  ["admin","Administrador"],
  ["manager","Gerente"],
  ["employee","Funcionário"],
  ["viewer","Visualizador"]
];

export default function Equipe() {
  const [members,setMembers]=useState<Member[]>([]);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/api/equipe");
    const d=await r.json();
    if(r.ok)setMembers(d.members??[]);
    else setError(d.error??"Não foi possível carregar a equipe.");
  }
  useEffect(()=>{load()},[]);

  async function changeRole(id:string,role:string){
    setError("");setMessage("");
    const r=await fetch("/api/equipe",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:id,role})});
    const d=await r.json();
    if(!r.ok){setError(d.error??"Não foi possível alterar a função.");return}
    setMembers(items=>items.map(m=>m.id===id?{...m,role}:m));
    setMessage("Função atualizada.");
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Equipe</h1><p className="muted">Consulte e gerencie as funções dos usuários da empresa.</p></div></div>
    {error&&<p style={{color:"#b91c1c"}}>{error}</p>}{message&&<p style={{color:"#166534"}}>{message}</p>}
    <section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Nome</th><th>Função</th><th>Cadastro</th></tr></thead><tbody>
      {members.map(m=><tr key={m.id}><td><b>{m.full_name}</b></td><td><select className="input" style={{margin:0,maxWidth:220}} value={m.role} onChange={e=>changeRole(m.id,e.target.value)}>{roles.map(r=><option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></td><td>{new Date(m.created_at).toLocaleDateString("pt-BR")}</td></tr>)}
      {!members.length&&<tr><td colSpan={3}>Nenhum usuário encontrado.</td></tr>}
    </tbody></table></div></section>
  </main></div>;
}
