import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Produtos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,sku,barcode,cost_price,sale_price,stock_quantity,minimum_stock,location,active,created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  const lowStockCount =
    products?.filter((product) => Number(product.stock_quantity) <= Number(product.minimum_stock)).length ?? 0;

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <h1 className="title">Produtos</h1>
            <p className="muted">Catálogo e controle de estoque.</p>
          </div>
          <Link className="btn" href="/produtos/novo">+ Novo produto</Link>
        </div>

        <section className="grid">
          <div className="card">
            <span className="muted">Produtos ativos</span>
            <div className="stat">{products?.length ?? 0}</div>
          </div>
          <div className="card">
            <span className="muted">Estoque baixo</span>
            <div className="stat">{lowStockCount}</div>
          </div>
        </section>

        <section className="section card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                  <th>Preço venda</th>
                  <th>Localização</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.stock_quantity}</td>
                    <td>{product.minimum_stock}</td>
                    <td>R$ {Number(product.sale_price).toFixed(2).replace(".", ",")}</td>
                    <td>{product.location || "—"}</td>
                  </tr>
                ))}
                {!products?.length && (
                  <tr>
                    <td colSpan={6}>{error ? "Não foi possível carregar os produtos." : "Nenhum produto cadastrado ainda."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
