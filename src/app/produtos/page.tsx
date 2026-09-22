"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Product={id:string;name:string;sku:string;barcode?:string;brand?:string;unit?:string;stock_quantity:number;minimum_stock:number;sale_price:number;location?:string;expiry_date?:string};

export default function Produtos(){
  const [products,setProducts]=useState<Product[]>([]);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(search=""){
    setLoading(true);setError("");
    try{const r=await fetch("/api/produtos"+(search?"?q="+encodeURIComponent(search):""));const d=await r.json();if(!r.ok)throw new Error(d.error);setProducts(d.products??[])}
    catch(e:any){setError(e.message??"Não foi possível carregar os produtos.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{const initial=new URLSearchParams(window.location.search).get("q")||"";setQ(initial);load(initial)},[]);
  const low=useMemo(()=>products.filter(p=>Number(p.stock_quantity)<=Number(p.minimum_stock)),[products]);
  const value=useMemo(()=>products.reduce((s,p)=>s+Number(p.stock_quantity)*Number(p.sale_price),0),[products]);

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Produtos</h1><p className="muted">Catálogo, preços, estoque e validade.</p></div><Link className="btn" href="/produtos/novo">+ Novo produto</Link></div>
    <section className="grid">
      <div className="card"><span className="muted">Produtos ativos</span><div className="stat">{products.length}</div></div>
      <div className="card"><span className="muted">Estoque baixo</span><div className="stat">{low.length}</div></div>
      <div className="card"><span className="muted">Valor a preço de venda</span><div className="stat">R$ {value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</div></div>
    </section>
    <section className="section card">
      <div style={{display:"flex",gap:12,marginBottom:18}}><input className="input" style={{margin:0}} placeholder="Buscar por nome..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load(q)}}/><button className="btn secondary" onClick={()=>load(q)}>Buscar</button><button className="btn secondary" onClick={()=>{setQ("");load("")}}>Limpar</button></div>
      {error&&<p style={{color:"#b91c1c"}}>{error}</p>}
      <div className="table-wrap"><table className="table"><thead><tr><th>Produto</th><th>SKU</th><th>Marca</th><th>Estoque</th><th>Mínimo</th><th>Venda</th><th>Local</th><th>Validade</th><th>Ação</th></tr></thead>
      <tbody>{loading?<tr><td colSpan={9}>Carregando...</td></tr>:products.map(p=><tr key={p.id}>
        <td><Link href={"/produtos/"+p.id}><b>{p.name}</b></Link></td><td>{p.sku}</td><td>{p.brand||"—"}</td>
        <td><b>{p.stock_quantity}</b> {p.unit||"UN"}</td><td>{p.minimum_stock}</td><td>R$ {Number(p.sale_price).toFixed(2).replace(".",",")}</td><td>{p.location||"—"}</td><td>{p.expiry_date?new Date(p.expiry_date+"T00:00:00").toLocaleDateString("pt-BR"):"—"}</td>
        <td><Link className="btn secondary" href={"/produtos/"+p.id}>Editar</Link></td>
      </tr>)}{!loading&&!products.length&&<tr><td colSpan={9}>Nenhum produto encontrado.</td></tr>}</tbody></table></div>
    </section>
  </main></div>;
}
