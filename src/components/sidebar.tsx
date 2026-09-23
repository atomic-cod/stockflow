"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePathname,useRouter } from "next/navigation";
import { Activity,AlertTriangle,BarChart3,Boxes,BrainCircuit,ClipboardList,Database,FileDown,FolderKanban,LayoutDashboard,LogOut,Package,ScanBarcode,Settings2,ShoppingCart,Truck,Users,UserRound,ArrowDownToLine,ArrowUpFromLine } from "lucide-react";
const items=[
 ["Dashboard","/dashboard",LayoutDashboard],["Produtos","/produtos",Package],["Scanner","/scanner",ScanBarcode],
 ["Categorias","/categorias",FolderKanban],["Compras","/compras",ShoppingCart],["Vendas","/vendas",Truck],
 ["Entradas","/entradas",ArrowDownToLine],["Saídas","/saidas",ArrowUpFromLine],["Inventário","/inventario",ClipboardList],
 ["Depósitos","/depositos",Boxes],["Transferências","/transferencias",ArrowUpFromLine],["Alertas","/alertas",AlertTriangle],["Fornecedores","/fornecedores",Database],
 ["Clientes","/clientes",UserRound],["Histórico","/historico",Activity],["Relatórios","/relatorios",BarChart3],
 ["Exportar","/exportar",FileDown],["Equipe","/equipe",Users],["Assistente IA","/ia",BrainCircuit]
] as const;
export function Sidebar(){
 const router=useRouter(),pathname=usePathname();
 async function logout(){const supabase=createClient();await supabase.auth.signOut();router.push("/login");router.refresh()}
 return <aside className="sidebar"><div className="brand-wrap"><div className="brand-mark">S</div><div><div className="brand">StockFlow</div><div className="brand-sub">Inventory OS</div></div></div>
 <nav className="nav">{items.map(([label,href,Icon])=>{const active=pathname===href||pathname.startsWith(href+"/");return <Link className={active?"active":""} key={href} href={href}><Icon size={16} strokeWidth={1.8}/><span>{label}</span></Link>})}</nav>
 <div className="sidebar-footer"><Link className={"nav-settings "+(pathname==="/configuracoes"?"active":"")} href="/configuracoes"><Settings2 size={16}/> Configurações</Link><button className="btn secondary" style={{width:"100%",marginTop:8}} onClick={logout}><LogOut size={16}/> Sair da conta</button></div></aside>;
}