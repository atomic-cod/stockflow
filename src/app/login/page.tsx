"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push("/dashboard");
    setLoading(false);
  }

  return <main className="login">
    <form className="login-card" onSubmit={handleSubmit}>
      <h1>Entrar no StockFlow</h1>
      <p className="muted">Acesse o controle de estoque da sua empresa.</p>
      <label>E-mail<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Senha<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <p style={{color:"#b91c1c"}}>{error}</p>}
      <button className="btn" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      <p className="muted">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p>
    </form>
  </main>;
}
