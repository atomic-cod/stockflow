"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";

export default function Exportar() {
  const [loading,setLoading]=useState(false);
  async function exportProducts(){
    setLoading(true);
    try{
      const r=await fetch("/api/produtos");
      const d=await r.json();
      const rows=d.products??[];
      const headers=["Nome","SKU","Código de barras","Marca","Estoque","Mínimo","Máximo","Custo","Venda","Local","Validade"];
      const csv=[headers,...rows.map((p:any)=>[p.name,p.sku,p.barcode??"",p.brand??"",p.stock_quantity,p.minimum_stock,p.maximum_stock??"",p.cost_price,p.sale_price,p.location??"",p.expiry_date??""])]
        .map(row=>row.map((v:any)=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\n");
      const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download="stockflow-produtos.csv";a.click();URL.revokeObjectURL(url);
    }finally{setLoading(false)}
  }
  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Exportação</h1><p className="muted">Baixe dados do estoque para análise e backup operacional.</p></div></div>
    <section className="card"><h2>Produtos</h2><p className="muted">Exporta os produtos ativos em CSV, compatível com Excel e Google Sheets.</p><button className="btn" onClick={exportProducts} disabled={loading}>{loading?"Gerando...":"Exportar CSV"}</button></section>
  </main></div>;
}
