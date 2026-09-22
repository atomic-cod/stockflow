"use client";
import { FormEvent,useEffect,useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useRouter } from "next/navigation";
type Option={id:string;name:string};
export default function NovoProduto(){
 const router=useRouter(); const [categories,setCategories]=useState<Option[]>([]),[suppliers,setSuppliers]=useState<Option[]>([]);
 const [form,setForm]=useState({name:"",sku:"",barcode:"",brand:"",unit:"UN",category_id:"",supplier_id:"",lot:"",expiry_date:"",description:"",cost_price:"",sale_price:"",minimum_stock:"0",maximum_stock:"",location:""});
 const [error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{Promise.all([fetch("/api/cadastros/categorias"),fetch("/api/cadastros/fornecedores")]).then(async([a,b])=>{const x=await a.json(),y=await b.json();if(a.ok)setCategories((x.items||[]).map((i:any)=>({id:i.id,name:i.name})));if(b.ok)setSuppliers((y.items||[]).map((i:any)=>({id:i.id,name:i.name})))})},[]);
 function update(field:string,value:string){setForm(c=>({...c,[field]:value}))}
 async function handleSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setLoading(true);try{const r=await fetch("/api/produtos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}),d=await r.json();if(!r.ok){setError(d.error??"Não foi possível cadastrar.");return}router.push("/produtos");router.refresh()}catch{setError("Não foi possível conectar ao servidor.")}finally{setLoading(false)}}
 return <div className="shell"><Sidebar/><main className="main"><div className="topbar"><div><div className="eyebrow">CATÁLOGO</div><h1 className="title">Novo produto</h1><p className="muted">Cadastre dados comerciais, logísticos e de rastreabilidade.</p></div></div>
 <form className="section card" onSubmit={handleSubmit}><div className="panel-head"><div><div className="eyebrow">IDENTIFICAÇÃO</div><h2>Dados principais</h2></div></div><div className="form-grid">
 <label>Nome *<input className="input" value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Ex.: Camiseta básica" required/></label>
 <label>SKU *<input className="input" value={form.sku} onChange={e=>update("sku",e.target.value)} placeholder="Ex.: CAM-001" required/></label>
 <label>Código de barras<input className="input" value={form.barcode} onChange={e=>update("barcode",e.target.value)} placeholder="EAN / UPC"/></label>
 <label>Marca<input className="input" value={form.brand} onChange={e=>update("brand",e.target.value)} placeholder="Ex.: Nike"/></label>
 <label>Categoria<select className="input" value={form.category_id} onChange={e=>update("category_id",e.target.value)}><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Fornecedor<select className="input" value={form.supplier_id} onChange={e=>update("supplier_id",e.target.value)}><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label>Unidade<select className="input" value={form.unit} onChange={e=>update("unit",e.target.value)}><option>UN</option><option>KG</option><option>G</option><option>L</option><option>ML</option><option>CX</option><option>PCT</option></select></label>
 <label>Localização<input className="input" value={form.location} onChange={e=>update("location",e.target.value)} placeholder="Ex.: A1-02"/></label>
 </div>
 <div className="panel-head section"><div><div className="eyebrow">RASTREABILIDADE</div><h2>Lote e validade</h2></div></div><div className="form-grid"><label>Lote<input className="input" value={form.lot} onChange={e=>update("lot",e.target.value)} placeholder="Ex.: LT-2026-001"/></label><label>Data de validade<input className="input" type="date" value={form.expiry_date} onChange={e=>update("expiry_date",e.target.value)}/></label></div>
 <div className="panel-head section"><div><div className="eyebrow">ESTOQUE & PREÇO</div><h2>Parâmetros operacionais</h2></div></div><div className="form-grid"><label>Preço de custo<input className="input" type="number" min="0" step="0.01" value={form.cost_price} onChange={e=>update("cost_price",e.target.value)}/></label><label>Preço de venda<input className="input" type="number" min="0" step="0.01" value={form.sale_price} onChange={e=>update("sale_price",e.target.value)}/></label><label>Estoque mínimo<input className="input" type="number" min="0" step="0.001" value={form.minimum_stock} onChange={e=>update("minimum_stock",e.target.value)}/></label><label>Estoque máximo<input className="input" type="number" min="0" step="0.001" value={form.maximum_stock} onChange={e=>update("maximum_stock",e.target.value)} placeholder="Opcional"/></label></div>
 <label>Descrição<textarea className="input" rows={4} value={form.description} onChange={e=>update("description",e.target.value)} placeholder="Descrição do produto"/></label>
 {error&&<p style={{color:"var(--danger)"}}>{error}</p>}<div style={{display:"flex",gap:12}}><button className="btn" type="submit" disabled={loading}>{loading?"Salvando...":"Salvar produto"}</button><button className="btn secondary" type="button" onClick={()=>router.push("/produtos")} disabled={loading}>Cancelar</button></div>
 </form></main></div>;
}