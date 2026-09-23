"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="eyebrow">ERRO DE APLICAÇÃO</div>
        <h1>Algo saiu do esperado</h1>
        <p className="muted">O StockFlow não conseguiu concluir esta operação. Tente novamente.</p>
        <button className="btn" onClick={() => reset()}>Tentar novamente</button>
      </div>
    </main>
  );
}
