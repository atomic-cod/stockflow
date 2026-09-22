import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
 const {data,error}=await supabase.from("products").select("*").eq("id",id).single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({product:data});
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
 const body=await request.json();
 const patch={name:String(body.name??"").trim(),sku:String(body.sku??"").trim(),barcode:String(body.barcode??"").trim()||null,description:String(body.description??"").trim()||null,brand:String(body.brand??"").trim()||null,unit:String(body.unit??"UN").trim().toUpperCase()||"UN",lot:String(body.lot??"").trim()||null,expiry_date:String(body.expiry_date??"").trim()||null,cost_price:Number(body.cost_price??0),sale_price:Number(body.sale_price??0),minimum_stock:Number(body.minimum_stock??0),maximum_stock:body.maximum_stock===""||body.maximum_stock==null?null:Number(body.maximum_stock),location:String(body.location??"").trim()||null};
 if(!patch.name||!patch.sku||[patch.cost_price,patch.sale_price,patch.minimum_stock].some(n=>!Number.isFinite(n)||n<0)|| (patch.maximum_stock!==null&&(!Number.isFinite(patch.maximum_stock)||patch.maximum_stock<0))) return NextResponse.json({error:"Dados inválidos."},{status:400});
 const {data,error}=await supabase.from("products").update(patch).eq("id",id).select("*").single();
 if(error)return NextResponse.json({error:error.code==="23505"?"SKU já utilizado.":error.message},{status:error.code==="23505"?409:400});
 return NextResponse.json({product:data});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
 const {error}=await supabase.from("products").update({active:false}).eq("id",id);
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
}
