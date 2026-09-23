"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Box, Layers3, Map, Maximize2, Minus, Package, Plus, Rotate3D, Search, Warehouse, X } from "lucide-react";

type Product = { product_id:string; name:string; sku:string; barcode?:string|null; quantity:number; unit?:string|null; image_url?:string|null; minimum_stock:number };
type Location = { location_id:string; location_code:string; location_name:string; location_type:string; x:number;y:number;z:number;width:number;depth:number;height:number;capacity:number|null;occupied:number;utilization:number;products:Product[] };
type WarehouseItem = { id:string; name:string; code:string; address?:string|null; active:boolean };

export default function MapaEstoque() {
  const [warehouses,setWarehouses]=useState<WarehouseItem[]>([]);
  const [warehouse,setWarehouse]=useState<WarehouseItem|null>(null);
  const [locations,setLocations]=useState<Location[]>([]);
  const [selected,setSelected]=useState<Location|null>(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [zoom,setZoom]=useState(1);
  const [rotation,setRotation]=useState(-35);
  const [tilt,setTilt]=useState(55);

  async function load(id?:string) {
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/mapa-estoque"+(id ? "?warehouse_id="+encodeURIComponent(id) : ""),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Não foi possível carregar o mapa.");
      setWarehouses(data.warehouses ?? []);
      setWarehouse(data.warehouse ?? null);
      setLocations(data.locations ?? []);
      setSelected(null);
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao carregar o mapa."); }
    finally { setLoading(false); }
  }

  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return locations;
    return locations.filter(l=>l.location_code.toLowerCase().includes(q)||l.location_name.toLowerCase().includes(q)||l.products.some(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)));
  },[locations,query]);

  const stats=useMemo(()=>{
    const occupied=locations.reduce((s,l)=>s+l.occupied,0);
    const capacity=locations.reduce((s,l)=>s+(l.capacity??0),0);
    return {occupied,capacity,utilization:capacity?Math.round(occupied/capacity*1000)/10:0,locations:locations.length,products:locations.reduce((s,l)=>s+l.products.length,0)};
  },[locations]);

  function locationColor(l:Location) {
    if(l.utilization >= 90) return "map-node critical";
    if(l.utilization >= 70) return "map-node high";
    if(l.utilization >= 35) return "map-node medium";
    return "map-node low";
  }

  return <div className="shell">
    <Sidebar/>
    <main className="main stock-map-page">
      <div className="topbar">
        <div><div className="eyebrow">VISÃO ESPACIAL</div><h1 className="title">Mapa avançado do estoque</h1><p className="muted">Navegue pelo depósito em uma visão 3D isométrica, encontre posições e abra o item diretamente no mapa.</p></div>
        <div className="map-actions"><button className="btn secondary" onClick={()=>setTilt(v=>v===55?70:55)}><Rotate3D size={16}/> 3D</button><button className="btn secondary" onClick={()=>setZoom(v=>Math.min(1.65,v+.12))}><Plus size={16}/></button><button className="btn secondary" onClick={()=>setZoom(v=>Math.max(.65,v-.12))}><Minus size={16}/></button><button className="btn secondary" onClick={()=>{setRotation(-35);setTilt(55);setZoom(1)}}><Maximize2 size={16}/></button></div>
      </div>

      <section className="map-toolbar card">
        <div className="map-select"><Warehouse size={17}/><select className="input" value={warehouse?.id??""} onChange={e=>load(e.target.value)}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></div>
        <div className="map-search"><Search size={16}/><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto, SKU ou posição..."/></div>
        <div className="map-mode"><Map size={15}/> MODO 3D</div>
      </section>

      {error && <div className="section card error-message">⚠ {error}</div>}
      {loading ? <section className="card map-loading">Carregando mapa espacial...</section> :
      <section className="map-layout">
        <div className="map-scene card">
          <div className="scene-hud"><span><span className="pulse-dot"/> AO VIVO</span><span>{warehouse?.name ?? "Depósito"}</span><span>{stats.locations} posições</span></div>
          <div className="warehouse-floor" style={{"--map-scale":zoom,"--map-rot":rotation+"deg","--map-tilt":tilt+"deg"} as React.CSSProperties}>
            <div className="floor-grid"/>
            {filtered.map(l=><button key={l.location_id} className={locationColor(l)+(selected?.location_id===l.location_id?" selected":"")} style={{left:(l.x*38+70)+"px",top:(l.y*32+65)+"px",width:Math.max(48,l.width*38)+"px",height:Math.max(48,l.depth*32)+"px",transform:"translateZ("+(l.z*32)+"px)"} } onClick={()=>setSelected(l)} title={l.location_name}>
              <span className="node-top"><Box size={13}/>{l.location_code}</span><strong>{l.occupied}</strong><small>{l.products.length} item(ns)</small>
            </button>)}
            <div className="map-axis axis-x">X</div><div className="map-axis axis-y">Y</div>
          </div>
          <div className="scene-legend"><span><i className="legend low"/> Livre</span><span><i className="legend medium"/> Em uso</span><span><i className="legend high"/> Alta ocupação</span><span><i className="legend critical"/> Crítico</span></div>
        </div>

        <aside className="map-panel card">
          {selected ? <>
            <div className="panel-head"><div><div className="eyebrow">POSIÇÃO SELECIONADA</div><h2>{selected.location_code}</h2></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={16}/></button></div>
            <div className="location-hero"><div className="location-icon"><Layers3 size={24}/></div><div><b>{selected.location_name}</b><span>{selected.location_type.toUpperCase()} · {selected.utilization}% ocupado</span></div></div>
            <div className="mini-kpis"><div><small>OCUPAÇÃO</small><b>{selected.occupied}</b></div><div><small>CAPACIDADE</small><b>{selected.capacity ?? "—"}</b></div><div><small>ITENS</small><b>{selected.products.length}</b></div></div>
            <div className="product-list">{selected.products.length ? selected.products.map(p=><Link className="map-product" key={p.product_id} href={"/produtos/"+p.product_id}><div className="product-dot"><Package size={14}/></div><div><b>{p.name}</b><span>SKU {p.sku}</span><small>{p.quantity} {p.unit ?? "UN"} · abrir ficha</small></div></Link>) : <div className="empty-state">Posição livre.</div>}</div>
          </> : <>
            <div className="eyebrow">EXPLORADOR 3D</div><h2>Selecione uma posição</h2><p className="muted">Clique em qualquer bloco do mapa para abrir a posição, ver os produtos armazenados e a ocupação.</p>
            <div className="explorer-tip"><Rotate3D size={18}/><span>Use os controles para aproximar, afastar e alterar a perspectiva.</span></div>
          </>}
        </aside>
      </section>}

      <section className="grid map-kpis">
        <div className="card"><span className="muted">Posições mapeadas</span><div className="stat">{stats.locations}</div></div>
        <div className="card"><span className="muted">Unidades armazenadas</span><div className="stat">{stats.occupied.toLocaleString("pt-BR")}</div></div>
        <div className="card"><span className="muted">Capacidade</span><div className="stat">{stats.capacity.toLocaleString("pt-BR")}</div></div>
        <div className="card"><span className="muted">Ocupação média</span><div className="stat">{stats.utilization}%</div></div>
      </section>
    </main>
  </div>;
}
