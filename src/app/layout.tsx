import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";

import "@/styles/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "LPH | Lazer, Pousadas e Hotéis",
  description: "Landing page moderna de uma rede de hotéis com foco em experiências pelo Brasil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${sora.variable}`}>{children}</body>
    </html>
  );
}
