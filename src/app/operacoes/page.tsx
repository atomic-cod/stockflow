"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ScanBarcode, MapPin, PackageCheck, Plus, Play, CheckCircle2, Search, Boxes } from "lucide-react";

type Warehouse={id:string;name:string;code:string};
type Location={id:string;warehouse_id:string;code:string;name:string;location_type:string;aisle?:string|null;rack?:string|null;level?:number|null};
type Task={id:string;warehouse_id:string;task_type:string;status:string;priority:number;reference_code:string|null;notes:string|null;created_at:string};
type Item={id:string;task_id:string;product_id:string;location_id:string|null;requested_quantity:number;picked_quantity:number;status:string;scanned_barcode:string|null};
type Product={id:string;name:string;sku:string;barcode:string|null;stock_quantity:number};
type ScanContext={product:Product;warehouse:{id:string;quantity:number};location:Location|null};

export default function Operacoes(){
  const [tab,setTab]=useState<"scanner"|"picking"|"enderecamento">("scanner");
  const [warehouses,setWarehouses]=useState<Warehouse[]>([]); const [locations,setLocations]=useState<Location[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]); const [items,setItems]=useState<Item[]>([]); const [products,setProducts]=useState<Product[]>([]);
  const [warehouseId,setWarehouseId]=useState(""); const [scan,setScan]=useState(""); const [scanContext,setScanContext]=useState<ScanContext|null>(null);
  const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [selectedTask,setSelectedTask]=useState("");
  const [pickProductId,setPickProductId]=useState(""); const [pickQuantity,setPickQuantity]=useState("1"); const [addressLocationId,setAddressLocationId]=useState("");
  const [camera,setCamera]=useState(false); const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const lastDetected=useRef("");

  async function load(){
    const [ops,prods]=await Promise.all([fetch("/api/operacoes").then(r=>r.json()),fetch("/api/produtos").then(r=>r.json())]);
    if(ops.error){setError(ops.error);return} setWarehouses(ops.warehouses??[]); setLocations(ops.locations??[]); setTasks(ops.tasks??[]); setItems(ops.items??[]); setProducts(prods.products??[]);
    if(!warehouseId && ops.warehouses?.[0]) setWarehouseId(ops.warehouses[0].id);
  }
  useEffect(()=>{load()},[]); useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);
  const visibleTasks=tasks.filter(t=>!warehouseId||t.warehouse_id===warehouseId); const pendingItems=items.filter(i=>visibleTasks.some(t=>t.id===i.task_id)&&!['picked','cancelled'].includes(i.status));
  const productById=useMemo(()=>Object.fromEntries(products.map(p=>[p.id,p])),[products]); const locationById=useMemo(()=>Object.fromEntries(locations.map(l=>[l.id,l])),[locations]);
  const warehouseLocations=locations.filter(l=>l.warehouse_id===warehouseId);

  async function scanCode(code=scan){
    setError(""); setMessage(""); setScan(code);
    if(!warehouseId||!code.trim()){setScanContext(null);return}
    const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"scan",warehouse_id:warehouseId,code:code.trim()})});
    const d=await r.json(); if(!r.ok){setScanContext(null);setError(d.error);return} setScanContext(d.context); setMessage("Produto localizado: "+d.context.product.name);
  }

  async function createTask(){
    setError(""); setMessage(""); const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_task",warehouse_id:warehouseId,task_type:"picking",priority:2})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Ordem de picking criada."); setSelectedTask(d.task.id); await load();
  }
  async function addItem(){
    const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add_item",task_id:selectedTask,product_id:pickProductId,quantity:Number(pickQuantity)})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Item adicionado ao picking."); setPickProductId(""); setPickQuantity("1"); await load();
  }
  async function pick(item:Item){
    setError(""); setMessage(""); const qty=item.requested_quantity-item.picked_quantity;
    const r=await fetch("/api/operacoes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pick",item_id:item.id,quantity:qty,barcode:scan})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage(d.result?.location?.code?`Item separado no endereço ${d.result.location.code}.`:`Item separado e estoque atualizado.`); setScan(""); setScanContext(null); await load();
  }
  async function startCamera(){
    if(camera){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCamera(false);return}
    try{const Detector=(window as any).BarcodeDetector;if(!Detector||!navigator.mediaDevices?.getUserMedia){setError("Seu navegador não suporta leitura automática. Use o campo de código.");return}
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}}); streamRef.current=stream; if(videoRef.current) videoRef.current.srcObject=stream; setCamera(true);
      const detector=new Detector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf"]});
      const loop=async()=>{if(!streamRef.current||!videoRef.current)return;try{const codes=await detector.detect(videoRef.current);const code=codes[0]?.rawValue;if(code&&code!==lastDetected.current){lastDetected.current=code;await scanCode(code);setTimeout(()=>{lastDetected.current=""},1200)}}catch{}requestAnimationFrame(loop)}; videoRef.current?.play().then(loop);
    }catch{setError("Não foi possível acessar a câmera.")}
  }
  async function addressProduct(){
    if(!scanContext?.product||!warehouseId||!addressLocationId){setError("Escaneie um produto e selecione um endereço.");return}
    const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"address",product_id:scanContext.product.id,warehouse_id:warehouseId,location_id:addressLocationId})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Produto endereçado em "+(warehouseLocations.find(l=>l.id===addressLocationId)?.code??"local selecionado")+"."); await load(); await scanCode(scan);
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Central de Operações</h1><p className="muted">Scanner, picking e endereçamento com validação do endereço físico.</p></div></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>{([["scanner","Scanner",ScanBarcode],["picking","Picking",PackageCheck],["enderecamento","Endereçamento",MapPin]] as const).map(([key,label,Icon])=><button key={key} className={tab===key?"btn":"btn secondary"} onClick={()=>setTab(key)}><Icon size={16}/>{label}</button>)}</div>
    <section className="card" style={{marginBottom:16}}><label>Depósito<select className="input" value={warehouseId} onChange={e=>{setWarehouseId(e.target.value);setScanContext(null)}}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label></section>

    {tab==="scanner"&&<section className="card"><h2>Scanner operacional</h2><p className="muted">Leia SKU/EAN para localizar produto, saldo e endereço antes da execução.</p>{camera&&<video ref={videoRef} muted playsInline style={{width:"100%",maxWidth:680,aspectRatio:"16/9",objectFit:"cover",borderRadius:14,background:"#111827"}}/>}<div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}><label style={{flex:1,minWidth:260}}>Código de barras / SKU<input autoFocus className="input" value={scan} onChange={e=>setScan(e.target.value)} placeholder="Escaneie ou digite o código" onKeyDown={e=>{if(e.key==="Enter")scanCode()}}/></label><button className="btn" onClick={()=>scanCode()}><Search size={16}/> Localizar</button><button className="btn secondary" onClick={startCamera}><ScanBarcode size={16}/>{camera?"Parar câmera":"Abrir câmera"}</button></div>
      {scanContext&&<div className="card" style={{marginTop:16,border:"1px solid rgba(148,163,184,.18)"}}><strong>{scanContext.product.name}</strong><p className="muted">SKU {scanContext.product.sku} · EAN {scanContext.product.barcode??"—"}</p><div style={{display:"flex",gap:20,flexWrap:"wrap"}}><span><strong>Saldo no depósito:</strong> {scanContext.warehouse.quantity}</span><span><strong>Endereço:</strong> {scanContext.location?.code??"Não endereçado"}</span></div><div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}><button className="btn" onClick={()=>setTab("picking")}><PackageCheck size={16}/> Usar no picking</button><button className="btn secondary" onClick={()=>setTab("enderecamento")}><MapPin size={16}/> Endereçar</button></div></div>}
    </section>}

    {tab==="picking"&&<section className="card"><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><h2>Picking</h2><p className="muted">Ordens abertas e itens pendentes de separação.</p></div><button className="btn" onClick={createTask}><Plus size={16}/> Nova ordem</button></div>
      {visibleTasks.length===0?<p className="muted">Nenhuma ordem neste depósito.</p>:visibleTasks.map(t=><div key={t.id} className="card" style={{marginTop:12,border:"1px solid rgba(148,163,184,.18)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><strong>Picking #{t.id.slice(0,8)}</strong><p className="muted">Prioridade {t.priority} · {t.status}</p></div>{t.status!=="completed"&&t.status!=="cancelled"&&<button className="btn secondary" onClick={()=>setSelectedTask(t.id)}><Play size={15}/> Abrir</button>}</div>{selectedTask===t.id&&items.filter(i=>i.task_id===t.id).map(i=><div key={i.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"center",padding:"12px 0",borderTop:"1px solid rgba(148,163,184,.12)"}}><div><strong>{productById[i.product_id]?.name??i.product_id}</strong><div className="muted">Local: {i.location_id?(locationById[i.location_id]?.code??"—"):"A definir"} · {i.picked_quantity}/{i.requested_quantity}</div></div><span>{i.status}</span><button className="btn" disabled={i.status==="picked"} onClick={()=>pick(i)}><CheckCircle2 size={15}/> Separar</button></div>)}</div>)}
      <div className="card" style={{marginTop:16,border:"1px solid rgba(148,163,184,.18)"}}><strong>Adicionar item à ordem</strong><div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:10,marginTop:10}}><select className="input" value={pickProductId} onChange={e=>setPickProductId(e.target.value)}><option value="">Selecione o produto...</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><input className="input" type="number" min="0.001" step="0.001" value={pickQuantity} onChange={e=>setPickQuantity(e.target.value)}/><button className="btn" disabled={!selectedTask||!pickProductId} onClick={addItem}>Adicionar</button></div></div><p className="muted" style={{marginTop:16}}>Itens pendentes: {pendingItems.length}</p>
    </section>}

    {tab==="enderecamento"&&<section className="card"><h2>Endereçamento</h2><p className="muted">Selecione exatamente o endereço físico. O sistema mantém o vínculo entre estoque, depósito e localização.</p><label>Produto (SKU/EAN)<div style={{display:"flex",gap:8}}><input className="input" value={scan} onChange={e=>setScan(e.target.value)} placeholder="SKU, EAN ou código interno" onKeyDown={e=>{if(e.key==="Enter")scanCode()}}/><button className="btn secondary" onClick={()=>scanCode()}><Search size={16}/> Localizar</button></div></label>{scanContext&&<div className="card" style={{marginTop:14}}><strong>{scanContext.product.name}</strong><p className="muted">Endereço atual: {scanContext.location?.code??"não definido"} · Saldo no depósito: {scanContext.warehouse.quantity}</p><label>Novo endereço<select className="input" value={addressLocationId} onChange={e=>setAddressLocationId(e.target.value)}><option value="">Selecione...</option>{warehouseLocations.map(l=><option key={l.id} value={l.id}>{l.code} · {l.name}{l.aisle?` · Corredor ${l.aisle}`:""}{l.rack?` · Rack ${l.rack}`:""}</option>)}</select></label><button className="btn" style={{marginTop:10}} onClick={addressProduct}><MapPin size={16}/> Confirmar endereço</button></div>}{!warehouseLocations.length&&<div className="card" style={{marginTop:14}}><Boxes size={18}/><p className="muted">Este depósito ainda não possui endereços cadastrados.</p></div>}</section>}
    {(message||error)&&<div className="card" style={{marginTop:16}}><p style={{color:error?"#b91c1c":"#166534"}}>{error||message}</p></div>}
  </main></div>
}
