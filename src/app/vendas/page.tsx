"use client";

import { useEffect,useMemo,useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Product={id:string;name:string;sku:string;stock_quantity:number;sale_price:number};
type Customer={id:string;name:string};
type Item={product_id:string;quantity:string};

export default function Vendas(){
 const [products,setProducts]=useState<Product[]>([]),[customers,setCustomers]=useState<Customer[]>([]);
 const [customerId,setCustomerId]=useState(""),[notes,setNotes]=useState("");
 const [items,setItems]=useState<Item[]>([{product_id:"",quantity:"1"}]),[message,setMessage]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{Promise.all([fetch("/api/produtos").then(r=>r.json()),fetch("/api/cadastros/clientes").then(r=>r.json())]).then(([p,c])=>{setProducts(p.products??[]);setCustomers(c.items??[])})},[]);
 const total=useMemo(()=>items.reduce((sum,i)=>{const p=products.find(x=>x.id===i.product_id);return sum+(Number(i.quantity)||0)*(Number(p?.sale_price)||0)},0),[items,products]);
 function change(index:number,key:keyof Item,value:string){setItems(a=>a.map((it,i)=>i===index?{...it,[key]:value}:it))}
 function add(){setItems(a=>[...a,{product_id:"",quantity:"1"}])}
 async function submit(){setError("");setMessage("");setLoading(true);const valid=items.filter(i=>i.product_id&&Number(i.quantity)>0);if(!valid.length){setError("Preencha os itens.");setLoading(false);return}const r=await fetch("/api/vendas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer_id:customerId,notes,items:valid.map(i=>({product_id:i.product_id,quantity:Number(i.quantity)}))})});const d=await r.json();if(!r.ok)setError(d.error??"Erro ao registrar venda.");else{setMessage("Venda registrada e estoque atualizado.");setItems([{product_id:"",quantity:"1"}]);setNotes("")}setLoading(false)}
 return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><h1 className="title">Vendas</h1><p className="muted">Registre vendas com vários produtos em uma única operação.</p></div></div>
 <section className="section card"><label>Cliente<select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Consumidor final</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 {items.map((item,index)=><div className="card" key={index} style={{marginBottom:12}}><div className="form-grid"><label>Produto<select className="input" value={item.product_id} onChange={e=>change(index,"product_id",e.target.value)}><option value="">Selecione...</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.sku} (estoque: {p.stock_quantity})</option>)}</select></label><label>Quantidade<input className="input" type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>change(index,"quantity",e.target.value)}/></label></div></div>)}
 <button className="btn secondary" onClick={add}>+ Adicionar produto</button><label style={{display:"block",marginTop:16}}>Observações<textarea className="input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><h2>Total: R$ {total.toFixed(2).replace(".",",")}</h2>{error&&<p style={{color:"#b91c1c"}}>{error}</p>}{message&&<p style={{color:"#166534"}}>{message}</p>}<button className="btn" onClick={submit} disabled={loading}>{loading?"Processando...":"Registrar venda"}</button></section></main></div>
}
