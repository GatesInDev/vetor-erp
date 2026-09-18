import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Vetor ERP", description: "Industrial flooring operations and finance" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
