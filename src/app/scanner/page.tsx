"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";

export default function Scanner() {
  const videoRef=useRef<HTMLVideoElement>(null);
  const [barcode,setBarcode]=useState("");
  const [status,setStatus]=useState("Aponte a câmera para o código de barras.");
  const [supported,setSupported]=useState(true);
  const streamRef=useRef<MediaStream|null>(null);

  useEffect(()=>{
    let stopped=false;
    async function start(){
      if(!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia){setSupported(false);return}
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
        streamRef.current=stream;
        if(videoRef.current) videoRef.current.srcObject=stream;
        const Detector=(window as any).BarcodeDetector;
        const detector=new Detector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf"]});
        async function scan(){
          if(stopped||!videoRef.current)return;
          try{
            const codes=await detector.detect(videoRef.current);
            if(codes.length&&codes[0].rawValue){
              setBarcode(codes[0].rawValue);
              setStatus("Código encontrado: "+codes[0].rawValue);
              stopped=true;
              return;
            }
          }catch{}
          requestAnimationFrame(scan);
        }
        videoRef.current?.play().then(()=>scan()).catch(()=>{});
      }catch{setSupported(false)}
    }
    start();
    return()=>{stopped=true;streamRef.current?.getTracks().forEach(t=>t.stop())};
  },[]);

  return <div className="shell"><Sidebar/><main className="main">
    <div className="topbar"><div><h1 className="title">Leitor de código de barras</h1><p className="muted">Use a câmera para localizar produtos rapidamente.</p></div></div>
    <section className="card">
      {supported?<video ref={videoRef} muted playsInline style={{width:"100%",maxWidth:720,borderRadius:16,background:"#111827",aspectRatio:"16/9",objectFit:"cover"}}/>:<p>Seu navegador não disponibilizou o leitor automático. Digite o código abaixo para pesquisar.</p>}
      <p className="muted">{status}</p>
      <label>Código<input className="input" value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="EAN, UPC ou código interno" onKeyDown={e=>{if(e.key==="Enter"&&barcode)window.location.href="/produtos?q="+encodeURIComponent(barcode)}}/></label>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn" onClick={()=>{if(barcode)window.location.href="/produtos?q="+encodeURIComponent(barcode)}}>Buscar produto</button><Link className="btn secondary" href="/produtos/novo">Cadastrar produto</Link></div>
    </section>
  </main></div>;
}
