"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          company_name: company.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage("Conta criada. Verifique seu e-mail para confirmar o acesso e depois entre no StockFlow.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Criar conta</h1>
        <p className="muted">Comece seu controle de estoque no StockFlow.</p>
        <label>Seu nome<input className="input" value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>Empresa<input className="input" value={company} onChange={e => setCompany(e.target.value)} required /></label>
        <label>E-mail<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Senha<input className="input" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        {message && <p style={{ color: "#166534" }}>{message}</p>}
        <button className="btn" type="submit" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
        <p className="muted">Já tem conta? <Link href="/login">Entrar</Link></p>
      </form>
    </main>
  );
}
