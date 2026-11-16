import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "WarungFlow - Keuangan dan operasional warung sembako",
  description: "Catat penjualan, stok, supplier, dan pisahkan uang usaha ke empat dompet.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2563EB" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
