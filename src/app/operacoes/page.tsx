"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ScanBarcode, MapPin, PackageCheck, Plus, Play, CheckCircle2 } from "lucide-react";

type Warehouse={id:string;name:string;code:string};
type Location={id:string;warehouse_id:string;code:string;name:string;location_type:string};
type Task={id:string;warehouse_id:string;task_type:string;status:string;priority:number;reference_code:string|null;notes:string|null;created_at:string};
type Item={id:string;task_id:string;product_id:string;location_id:string|null;requested_quantity:number;picked_quantity:number;status:string;scanned_barcode:string|null};
type Product={id:string;name:string;sku:string;barcode:string|null;stock_quantity:number};

export default function Operacoes(){
  const [tab,setTab]=useState<"scanner"|"picking"|"enderecamento">("scanner");
  const [warehouses,setWarehouses]=useState<Warehouse[]>([]);
  const [locations,setLocations]=useState<Location[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [warehouseId,setWarehouseId]=useState("");
  const [scan,setScan]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [selectedTask,setSelectedTask]=useState("");
  const [pickProductId,setPickProductId]=useState("");
  const [pickQuantity,setPickQuantity]=useState("1");
  const [camera,setCamera]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);

  async function load(){
    const [ops,prods]=await Promise.all([fetch("/api/operacoes").then(r=>r.json()),fetch("/api/produtos").then(r=>r.json())]);
    setWarehouses(ops.warehouses??[]); setLocations(ops.locations??[]); setTasks(ops.tasks??[]); setItems(ops.items??[]); setProducts(prods.products??[]);
    if(!warehouseId && ops.warehouses?.[0]) setWarehouseId(ops.warehouses[0].id);
  }
  useEffect(()=>{load()},[]);
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);

  const visibleTasks=tasks.filter(t=>!warehouseId||t.warehouse_id===warehouseId);
  const pendingItems=items.filter(i=>visibleTasks.some(t=>t.id===i.task_id)&&i.status!=="picked"&&i.status!=="cancelled");
  const productById=useMemo(()=>Object.fromEntries(products.map(p=>[p.id,p])),[products]);
  const locationById=useMemo(()=>Object.fromEntries(locations.map(l=>[l.id,l])),[locations]);

  async function createTask(){
    setError(""); setMessage("");
    const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_task",warehouse_id:warehouseId,task_type:"picking",priority:2})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Ordem de picking criada."); setSelectedTask(d.task.id); await load();
  }

  async function pick(item:Item){
    setError(""); setMessage("");
    const qty=item.requested_quantity-item.picked_quantity;
    const r=await fetch("/api/operacoes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pick",item_id:item.id,quantity:qty,barcode:scan})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Item separado e estoque atualizado."); setScan(""); await load();
  }

  async function startCamera(){
    if(camera){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCamera(false);return}
    try{
      const Detector=(window as any).BarcodeDetector;
      if(!Detector||!navigator.mediaDevices?.getUserMedia){setError("Seu navegador não suporta leitura automática. Use o campo de código.");return}
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
      streamRef.current=stream; if(videoRef.current) videoRef.current.srcObject=stream; setCamera(true);
      const detector=new Detector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf"]});
      const loop=async()=>{if(!streamRef.current||!videoRef.current)return;try{const codes=await detector.detect(videoRef.current);if(codes[0]?.rawValue){setScan(codes[0].rawValue);setMessage("Código lido: "+codes[0].rawValue);}}catch{};requestAnimationFrame(loop)}; videoRef.current?.play().then(loop);
    }catch{setError("Não foi possível acessar a câmera.")}
  }

  const scannedProduct=products.find(p=>p.barcode===scan||p.sku===scan);
  async function addressProduct(){
    if(!scannedProduct||!warehouseId){setError("Leia um produto e selecione o depósito.");return}
    const available=locations.filter(l=>l.warehouse_id===warehouseId);
    const location=available[0];
    if(!location){setError("Este depósito ainda não possui endereços.");return}
    const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"address",product_id:scannedProduct.id,warehouse_id:warehouseId,location_id:location.id})});
    const d=await r.json(); if(!r.ok){setError(d.error);return} setMessage("Produto endereçado em "+location.code+"."); await load();
  }

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Central de Operações</h1><p className="muted">Scanner, picking e endereçamento em um único fluxo operacional.</p></div></div>
    <div className="tabs" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <button className={tab==="scanner"?"btn":"btn secondary"} onClick={()=>setTab("scanner")}><ScanBarcode size={16}/> Scanner</button>
      <button className={tab==="picking"?"btn":"btn secondary"} onClick={()=>setTab("picking")}><PackageCheck size={16}/> Picking</button>
      <button className={tab==="enderecamento"?"btn":"btn secondary"} onClick={()=>setTab("enderecamento")}><MapPin size={16}/> Endereçamento</button>
    </div>
    <section className="card" style={{marginBottom:16}}>
      <label>Depósito<select className="input" value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
    </section>

    {tab==="scanner"&&<section className="card">
      <h2>Scanner operacional</h2><p className="muted">Leia SKU/EAN para localizar o produto e iniciar a próxima ação.</p>
      {camera&&<video ref={videoRef} muted playsInline style={{width:"100%",maxWidth:680,aspectRatio:"16/9",objectFit:"cover",borderRadius:14,background:"#111827"}}/>}
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap"}}>
        <label style={{flex:1,minWidth:260}}>Código de barras / SKU<input autoFocus className="input" value={scan} onChange={e=>setScan(e.target.value)} placeholder="Escaneie ou digite o código" onKeyDown={e=>{if(e.key==="Enter")setMessage(scannedProduct?"Produto: "+scannedProduct.name:"Produto não localizado")}}/></label>
        <button className="btn" onClick={startCamera}><ScanBarcode size={16}/>{camera?"Parar câmera":"Abrir câmera"}</button>
      </div>
      {scannedProduct?<div className="card" style={{marginTop:16}}><strong>{scannedProduct.name}</strong><p className="muted">SKU {scannedProduct.sku} · Estoque {scannedProduct.stock_quantity}</p><button className="btn" onClick={()=>setTab("enderecamento")}><MapPin size={16}/> Endereçar produto</button></div>:scan&&<p className="muted">Nenhum produto encontrado.</p>}
    </section>}

    {tab==="picking"&&<section className="card">
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><h2>Picking</h2><p className="muted">Ordens abertas e itens pendentes de separação.</p></div><button className="btn" onClick={createTask}><Plus size={16}/> Nova ordem</button></div>
      {visibleTasks.length===0?<p className="muted">Nenhuma ordem neste depósito.</p>:visibleTasks.map(t=><div key={t.id} className="card" style={{marginTop:12,border:"1px solid rgba(148,163,184,.18)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><strong>Picking #{t.id.slice(0,8)}</strong><p className="muted">Prioridade {t.priority} · {t.status}</p></div>{t.status==="open"&&<button className="btn secondary" onClick={()=>setSelectedTask(t.id)}><Play size={15}/> Abrir</button>}</div>
        {selectedTask===t.id&&items.filter(i=>i.task_id===t.id).map(i=><div key={i.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,alignItems:"center",padding:"12px 0",borderTop:"1px solid rgba(148,163,184,.12)"}}>
          <div><strong>{productById[i.product_id]?.name??i.product_id}</strong><div className="muted">Local: {i.location_id?(locationById[i.location_id]?.code??"—"):"A definir"} · {i.picked_quantity}/{i.requested_quantity}</div></div>
          <span>{i.status}</span><button className="btn" disabled={i.status==="picked"} onClick={()=>pick(i)}><CheckCircle2 size={15}/> Separar</button>
        </div>)}
      </div>)}
      <div className="card" style={{marginTop:16,border:"1px solid rgba(148,163,184,.18)"}}><strong>Adicionar item à ordem</strong><div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:10,marginTop:10}}><select className="input" value={pickProductId} onChange={e=>setPickProductId(e.target.value)}><option value="">Selecione o produto...</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><input className="input" type="number" min="0.001" step="0.001" value={pickQuantity} onChange={e=>setPickQuantity(e.target.value)}/><button className="btn" disabled={!selectedTask||!pickProductId} onClick={async()=>{const r=await fetch("/api/operacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add_item",task_id:selectedTask,product_id:pickProductId,quantity:Number(pickQuantity)})});const d=await r.json();if(!r.ok){setError(d.error);return}setMessage("Item adicionado ao picking.");setPickProductId("");setPickQuantity("1");await load()}}>Adicionar</button></div><p className="muted" style={{marginTop:8}}>Abra uma ordem acima para adicionar itens.</p></div><div style={{marginTop:16}}><p className="muted">Itens pendentes: {pendingItems.length}</p></div>
    </section>}

    {tab==="enderecamento"&&<section className="card">
      <h2>Endereçamento rápido</h2><p className="muted">O produto será associado ao primeiro endereço livre disponível no depósito. A próxima etapa é permitir escolha visual do endereço no mapa.</p>
      <label>Produto<input className="input" value={scan} onChange={e=>setScan(e.target.value)} placeholder="SKU, EAN ou código interno"/></label>
      {scannedProduct&&<div className="card" style={{marginTop:12}}><strong>{scannedProduct.name}</strong><p className="muted">Endereço atual: {locations.find(l=>l.id===items.find(i=>i.product_id===scannedProduct.id)?.location_id)?.code??"não definido"}</p><button className="btn" onClick={addressProduct}><MapPin size={16}/> Endereçar automaticamente</button></div>}
    </section>}

    {(message||error)&&<div className="card" style={{marginTop:16}}><p style={{color:error?"#b91c1c":"#166534"}}>{error||message}</p></div>}
  </main></div>
}
