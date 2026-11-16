"use client";
import { POS } from "@/components/POS";
import { PageHeader } from "@/components/ui";
export default function Kasir() {
  return (<><PageHeader title="Kasir" desc="Pilih produk, lalu bayar. Stok berkurang otomatis." /><POS /></>);
}
