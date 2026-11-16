"use client";
import { POS } from "@/components/POS";
import { PageHeader } from "@/components/ui";
export default function BelanjaInternal() {
  return (<><PageHeader title="Belanja Internal" desc="Untuk barang yang diambil atau dibeli pemilik dari warung sendiri. Dicatat terpisah dari penjualan pelanggan." /><POS internal /></>);
}
