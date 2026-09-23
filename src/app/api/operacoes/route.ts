import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouse_id");
  const status = url.searchParams.get("status");

  let taskQuery = supabase.from("warehouse_tasks")
    .select("id,warehouse_id,task_type,status,priority,reference_code,notes,assigned_to,created_at,started_at,completed_at")
    .order("priority", { ascending: true }).order("created_at", { ascending: false });
  if (warehouseId) taskQuery = taskQuery.eq("warehouse_id", warehouseId);
  if (status) taskQuery = taskQuery.eq("status", status);
  const { data: tasks, error } = await taskQuery.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (tasks ?? []).map(t => t.id);
  let items: any[] = [];
  if (ids.length) {
    const { data, error: itemError } = await supabase.from("warehouse_task_items")
      .select("id,task_id,product_id,location_id,requested_quantity,picked_quantity,status,scanned_barcode")
      .in("task_id", ids);
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });
    items = data ?? [];
  }

  const { data: warehouses, error: warehouseError } = await supabase.from("warehouses")
    .select("id,name,code").eq("active", true).order("created_at", { ascending: true });
  if (warehouseError) return NextResponse.json({ error: warehouseError.message }, { status: 400 });

  const { data: locations, error: locationError } = await supabase.from("warehouse_locations")
    .select("id,warehouse_id,code,name,location_type,aisle,rack,level,capacity")
    .eq("active", true).order("code");
  if (locationError) return NextResponse.json({ error: locationError.message }, { status: 400 });

  return NextResponse.json({ tasks: tasks ?? [], items, warehouses: warehouses ?? [], locations: locations ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "create_task") {
    const warehouseId = String(body.warehouse_id ?? "");
    const taskType = String(body.task_type ?? "picking");
    const priority = Number(body.priority ?? 2);
    if (!warehouseId || !["receiving","putaway","picking","packing","shipping","count","transfer"].includes(taskType)) {
      return NextResponse.json({ error: "Depósito e tipo de operação são obrigatórios." }, { status: 400 });
    }
    const { data, error } = await supabase.from("warehouse_tasks").insert({
      company_id: (await supabase.from("profiles").select("company_id").eq("id", user.id).single()).data?.company_id,
      warehouse_id: warehouseId, task_type: taskType, priority: Number.isFinite(priority) ? priority : 2,
      reference_code: String(body.reference_code ?? "").trim() || null,
      notes: String(body.notes ?? "").trim() || null, created_by: user.id
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ task: data }, { status: 201 });
  }

  if (action === "add_item") {
    const taskId = String(body.task_id ?? "");
    const productId = String(body.product_id ?? "");
    const quantity = Number(body.quantity);
    if (!taskId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Tarefa, produto e quantidade são obrigatórios." }, { status: 400 });
    }
    const { data: task } = await supabase.from("warehouse_tasks").select("id,warehouse_id").eq("id", taskId).single();
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    const locationId = body.location_id ? String(body.location_id) : null;
    const { data, error } = await supabase.from("warehouse_task_items").insert({
      company_id: (await supabase.from("profiles").select("company_id").eq("id", user.id).single()).data?.company_id,
      task_id: taskId, product_id: productId, requested_quantity: quantity, location_id: locationId
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data }, { status: 201 });
  }

  if (action === "address") {
    const { data, error } = await supabase.rpc("assign_product_location", {
      p_product_id: String(body.product_id ?? ""),
      p_warehouse_id: String(body.warehouse_id ?? ""),
      p_location_id: String(body.location_id ?? "")
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ address: data }, { status: 201 });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

export async function PUT(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  if (body.action !== "pick") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const { data, error } = await supabase.rpc("confirm_picking_item", {
    p_item_id: String(body.item_id ?? ""),
    p_quantity: Number(body.quantity),
    p_barcode: String(body.barcode ?? "") || null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}
