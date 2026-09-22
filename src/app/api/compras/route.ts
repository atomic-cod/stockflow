import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Não autenticado."},{status:401});
  const body=await request.json();
  const items=Array.isArray(body.items)?body.items:[];
  if(!items.length) return NextResponse.json({error:"Adicione pelo menos um produto."},{status:400});
  const {data,error}=await supabase.rpc("create_purchase",{
    p_supplier_id: body.supplier_id || null,
    p_invoice_number: String(body.invoice_number??"").trim() || null,
    p_notes: String(body.notes??"").trim() || null,
    p_items: items
  });
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({purchase_id:data},{status:201});
}

export async function GET() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Não autenticado."},{status:401});
  const {data,error}=await supabase.from("purchases").select("id,supplier_id,invoice_number,total,status,notes,created_at").order("created_at",{ascending:false}).limit(100);
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({items:data??[]});
}

export async function DELETE(request: Request) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Não autenticado."},{status:401});
  const body=await request.json();
  const id=String(body.purchase_id??"");
  if(!id) return NextResponse.json({error:"Identificador obrigatório."},{status:400});
  const {error}=await supabase.rpc("cancel_purchase",{p_purchase_id:id});
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({message:"Compra cancelada e estoque revertido."});
}