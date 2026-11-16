import { Lightbulb, Package, Sprout, Wallet } from "lucide-react";
import type { WalletKind } from "@warungflow/shared";

export const WALLET_UI: Record<WalletKind, {
  label: string; purpose: string; slug: string; icon: any; text: string; bg: string; border: string; hex: string;
}> = {
  capital: { label: "Modal", slug: "modal", purpose: "Dana untuk belanja stok dan bayar supplier", icon: Package, text: "text-w-capital", bg: "bg-w-capital-bg", border: "border-w-capital", hex: "#D97706" },
  operations: { label: "Operasional", slug: "operasional", purpose: "Listrik, kresek, bensin, dan biaya rutin", icon: Lightbulb, text: "text-w-operations", bg: "bg-w-operations-bg", border: "border-w-operations", hex: "#2563EB" },
  owner: { label: "Gaji Owner", slug: "gaji", purpose: "Gaji dan penarikan pemilik, terpisah dari biaya usaha", icon: Wallet, text: "text-w-owner", bg: "bg-w-owner-bg", border: "border-w-owner", hex: "#6D5BD0" },
  growth: { label: "Tumbuh", slug: "tumbuh", purpose: "Dana darurat dan pengembangan warung", icon: Sprout, text: "text-w-growth", bg: "bg-w-growth-bg", border: "border-w-growth", hex: "#15803D" },
};
export const SLUG_TO_KIND: Record<string, WalletKind> = { modal: "capital", operasional: "operations", gaji: "owner", tumbuh: "growth" };
