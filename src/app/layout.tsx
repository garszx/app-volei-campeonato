import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VôleiHub | Patotas e Campeonatos",
  description: "Organize listas de patotas com fila de espera, controle de Pix, placar ao vivo e campeonatos de vôlei de Quadra.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}