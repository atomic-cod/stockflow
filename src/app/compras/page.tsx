"use client";

import { useEffect,useMemo,useState } from "react";
import { Sidebar } from "@/components/sidebar";

type Product={id:string;name:string;sku:string;stock_quantity:number;cost_price:number};
type Supplier={id:string;name:string};
type Item={product_id:string;quantity:string;unit_cost:string};

export default function Compras(){
 const [products,setProducts]=useState<Product[]>([]),[suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [supplierId,setSupplierId]=useState(""),[invoice,setInvoice]=useState(""),[notes,setNotes]=useState("");
 const [items,setItems]=useState<Item[]>([{product_id:"",quantity:"1",unit_cost:"0"}]),[message,setMessage]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{Promise.all([fetch("/api/produtos").then(r=>r.json()),fetch("/api/cadastros/fornecedores").then(r=>r.json())]).then(([p,s])=>{setProducts(p.products??[]);setSuppliers(s.items??[])})},[]);
 const total=useMemo(()=>items.reduce((sum,i)=>sum+(Number(i.quantity)||0)*(Number(i.unit_cost)||0),0),[items]);
 function change(index:number,key:keyof Item,value:string){setItems(a=>a.map((it,i)=>i===index?{...it,[key]:value}:it))}
 function add(){setItems(a=>[...a,{product_id:"",quantity:"1",unit_cost:"0"}])}
 async function submit(){setError("");setMessage("");setLoading(true);const valid=items.filter(i=>i.product_id&&Number(i.quantity)>0&&Number(i.unit_cost)>=0);if(!valid.length){setError("Preencha os itens.");setLoading(false);return}const r=await fetch("/api/compras",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplier_id:supplierId,invoice_number:invoice,notes,items:valid.map(i=>({product_id:i.product_id,quantity:Number(i.quantity),unit_cost:Number(i.unit_cost)}))})});const d=await r.json();if(!r.ok)setError(d.error??"Erro ao registrar compra.");else{setMessage("Compra registrada e estoque atualizado.");setItems([{product_id:"",quantity:"1",unit_cost:"0"}]);setInvoice("");setNotes("")}setLoading(false)}
 return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><h1 className="title">Compras</h1><p className="muted">Registre uma compra com vários produtos em uma única operação.</p></div></div>
 <section className="section card"><div className="form-grid"><label>Fornecedor<select className="input" value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Nota fiscal<input className="input" value={invoice} onChange={e=>setInvoice(e.target.value)} /></label></div>
 {items.map((item,index)=><div className="card" key={index} style={{marginBottom:12}}><div className="form-grid"><label>Produto<select className="input" value={item.product_id} onChange={e=>change(index,"product_id",e.target.value)}><option value="">Selecione...</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}</select></label><label>Quantidade<input className="input" type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>change(index,"quantity",e.target.value)}/></label><label>Custo unitário<input className="input" type="number" min="0" step="0.01" value={item.unit_cost} onChange={e=>change(index,"unit_cost",e.target.value)}/></label></div></div>)}
 <button className="btn secondary" onClick={add}>+ Adicionar produto</button><label style={{display:"block",marginTop:16}}>Observações<textarea className="input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><h2>Total: R$ {total.toFixed(2).replace(".",",")}</h2>{error&&<p style={{color:"#b91c1c"}}>{error}</p>}{message&&<p style={{color:"#166534"}}>{message}</p>}<button className="btn" onClick={submit} disabled={loading}>{loading?"Processando...":"Registrar compra"}</button></section></main></div>
}
