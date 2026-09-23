import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="eyebrow">404</div>
        <h1>Página não encontrada</h1>
        <p className="muted">A página que você tentou acessar não existe ou foi movida.</p>
        <Link className="btn" href="/dashboard">Voltar ao dashboard</Link>
      </div>
    </main>
  );
}
