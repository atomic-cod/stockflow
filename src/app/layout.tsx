import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StockFlow — Gestão de Estoque",
    template: "%s | StockFlow",
  },
  description: "Plataforma profissional para controle de estoque, compras, vendas, inventário e operações.",
  applicationName: "StockFlow",
  keywords: ["estoque", "inventário", "gestão", "compras", "vendas", "SaaS"],
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
