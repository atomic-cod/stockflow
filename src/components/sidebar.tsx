"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const items = [
  ["Dashboard","/dashboard"],["Produtos","/produtos"],["Scanner","/scanner"],
  ["Categorias","/categorias"],["Compras","/compras"],["Vendas","/vendas"],
  ["Entradas","/entradas"],["Saídas","/saidas"],["Inventário","/inventario"],
  ["Depósitos","/depositos"],["Alertas","/alertas"],["Fornecedores","/fornecedores"],
  ["Clientes","/clientes"],["Histórico","/historico"],["Relatórios","/relatorios"],
  ["Exportar","/exportar"],["Equipe","/equipe"],["Assistente IA","/ia"],
];

export function Sidebar(){
  const router=useRouter();
  async function logout(){const supabase=createClient();await supabase.auth.signOut();router.push("/login");router.refresh();}
  return <aside className="sidebar">
    <div className="brand-wrap">
      <div className="brand-mark">S</div>
      <div><div className="brand">StockFlow</div><div className="brand-sub">Inventory OS</div></div>
    </div>
    <nav className="nav">{items.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="sidebar-footer"><button className="btn secondary" style={{width:"100%"}} onClick={logout}>Sair da conta</button></div>
  </aside>;
}
