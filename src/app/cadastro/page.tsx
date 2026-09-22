"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name,setName]=useState("");
  const [company,setCompany]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id:data.user.id, full_name:name, company_id:"00000000-0000-0000-0000-000000000000", role:"admin"
      });
      if (profileError) setError("Usuário criado, mas a empresa precisa ser configurada no onboarding.");
    }
    router.push("/dashboard");
    setLoading(false);
  }

  return <main className="login">
    <form className="login-card" onSubmit={handleSubmit}>
      <h1>Criar conta</h1>
      <p className="muted">Comece seu controle de estoque no StockFlow.</p>
      <label>Seu nome<input className="input" value={name} onChange={e=>setName(e.target.value)} required /></label>
      <label>Empresa<input className="input" value={company} onChange={e=>setCompany(e.target.value)} required /></label>
      <label>E-mail<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Senha<input className="input" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}
      <button className="btn" type="submit" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
      <p className="muted">Já tem conta? <Link href="/login">Entrar</Link></p>
    </form>
  </main>;
}
