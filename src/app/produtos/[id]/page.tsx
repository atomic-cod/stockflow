"use client";

import { FormEvent,useEffect,useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useParams,useRouter } from "next/navigation";

export default function ProdutoDetalhe(){
 const {id}=useParams<{id:string}>(); const router=useRouter();
 const [form,setForm]=useState({name:"",sku:"",barcode:"",description:"",cost_price:"0",sale_price:"0",minimum_stock:"0",maximum_stock:"",location:""});
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch(`/api/produtos/${id}`).then(r=>r.json()).then(d=>{if(d.product){const p=d.product;setForm({name:p.name??"",sku:p.sku??"",barcode:p.barcode??"",description:p.description??"",cost_price:String(p.cost_price??0),sale_price:String(p.sale_price??0),minimum_stock:String(p.minimum_stock??0),maximum_stock:p.maximum_stock==null?"":String(p.maximum_stock),location:p.location??"" )}else setError(d.error??"Produto não encontrado.")}).finally(()=>setLoading(false))},[id]);
 function update(k:string,v:string){setForm(f=>({...f,[k]:v}))}
 async function save(e:FormEvent){e.preventDefault();setError("");setMessage("");setLoading(true);const r=await fetch(`/api/produtos/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)setError(d.error??"Erro ao salvar.");else setMessage("Produto atualizado.");setLoading(false)}
 async function deactivate(){if(!confirm("Desativar este produto?"))return;const r=await fetch(`/api/produtos/${id}`,{method:"DELETE"});if(r.ok)router.push("/produtos");else{const d=await r.json();setError(d.error??"Erro ao desativar.")}}
 if(loading&&!form.name)return <div className="login"><div className="login-card">Carregando...</div></div>;
 return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><h1 className="title">Editar produto</h1><p className="muted">Atualize os dados do produto.</p></div></div><form className="section card" onSubmit={save}><div className="form-grid">{[["name","Nome"],["sku","SKU"],["barcode","Código de barras"],["location","Localização"],["cost_price","Preço de custo"],["sale_price","Preço de venda"],["minimum_stock","Estoque mínimo"],["maximum_stock","Estoque máximo"]].map(([k,l])=><label key={k}>{l}<input className="input" type={k.includes("price")||k.includes("stock")?"number":"text"} step={k.includes("price")?"0.01":"0.001"} value={form[k as keyof typeof form]} onChange={e=>update(k,e.target.value)} required={k==="name"||k==="sku"}/></label>)}</div><label>Descrição<textarea className="input" rows={4} value={form.description} onChange={e=>update("description",e.target.value)}/></label>{error&&<p style={{color:"#b91c1c"}}>{error}</p>}{message&&<p style={{color:"#166534"}}>{message}</p>}<div style={{display:"flex",gap:12}}><button className="btn" disabled={loading}>{loading?"Salvando...":"Salvar alterações"}</button><button type="button" className="btn secondary" onClick={deactivate}>Desativar</button><button type="button" className="btn secondary" onClick={()=>router.push("/produtos")}>Voltar</button></div></form></main></div>
}
