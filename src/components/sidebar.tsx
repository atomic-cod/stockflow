"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Sidebar(){
  const router=useRouter();
  async function logout(){const supabase=createClient();await supabase.auth.signOut();router.push("/login");router.refresh();}
  return <aside className="sidebar">
    <div className="brand">StockFlow</div>
    <nav className="nav">
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/produtos">Produtos</Link>
      <Link href="/categorias">Categorias</Link>
      <Link href="/compras">Compras</Link>
      <Link href="/vendas">Vendas</Link>
      <Link href="/entradas">Entradas</Link>
      <Link href="/saidas">Saídas</Link>
      <Link href="/inventario">Inventário</Link>
      <Link href="/depositos">Depósitos</Link>
      <Link href="/alertas">Alertas</Link>
      <Link href="/fornecedores">Fornecedores</Link>
      <Link href="/clientes">Clientes</Link>
      <Link href="/relatorios">Relatórios</Link>
      <Link href="/ia">Assistente IA</Link>
    </nav>
    <button className="btn secondary" onClick={logout}>Sair</button>
  </aside>;
}
