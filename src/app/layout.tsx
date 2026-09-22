import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "StockFlow", description: "Controle de estoque inteligente" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
