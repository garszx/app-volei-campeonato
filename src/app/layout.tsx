import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placar Vôlei | Central do Torneio",
  description: "Sistema profissional para gerenciamento e transmissão de campeonatos de voleibol.",
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