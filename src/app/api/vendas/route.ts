import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Não autenticado."},{status:401});
  const body=await request.json();
  const items=Array.isArray(body.items)?body.items:[];
  if(!items.length) return NextResponse.json({error:"Adicione pelo menos um produto."},{status:400});
  const {data,error}=await supabase.rpc("create_sale",{
    p_customer_id: body.customer_id || null,
    p_notes: String(body.notes??"").trim() || null,
    p_items: items
  });
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({sale_id:data},{status:201});
}
