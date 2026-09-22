"use client";

import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useRouter } from "next/navigation";

export default function NovoProduto() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    description: "",
    cost_price: "",
    sale_price: "",
    minimum_stock: "0",
    maximum_stock: "",
    location: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível cadastrar o produto.");
        return;
      }

      router.push("/produtos");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <h1 className="title">Novo produto</h1>
            <p className="muted">Cadastre um produto no catálogo da sua empresa.</p>
          </div>
        </div>

        <form className="section card" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Nome *
              <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Camiseta básica" required />
            </label>
            <label>
              SKU *
              <input className="input" value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="Ex.: CAM-001" required />
            </label>
            <label>
              Código de barras
              <input className="input" value={form.barcode} onChange={(e) => update("barcode", e.target.value)} placeholder="Ex.: 7890000000000" />
            </label>
            <label>
              Localização
              <input className="input" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Ex.: A1-02" />
            </label>
            <label>
              Preço de custo
              <input className="input" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => update("cost_price", e.target.value)} placeholder="0,00" />
            </label>
            <label>
              Preço de venda
              <input className="input" type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => update("sale_price", e.target.value)} placeholder="0,00" />
            </label>
            <label>
              Estoque mínimo
              <input className="input" type="number" min="0" step="0.001" value={form.minimum_stock} onChange={(e) => update("minimum_stock", e.target.value)} />
            </label>
            <label>
              Estoque máximo
              <input className="input" type="number" min="0" step="0.001" value={form.maximum_stock} onChange={(e) => update("maximum_stock", e.target.value)} placeholder="Opcional" />
            </label>
          </div>

          <label>
            Descrição
            <textarea className="input" rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Descrição do produto" />
          </label>

          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar produto"}
            </button>
            <button className="btn secondary" type="button" onClick={() => router.push("/produtos")} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
