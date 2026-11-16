"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Card, Empty, ErrorState, Loading, PageHeader, Table } from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { jam, rp, tgl } from "@/lib/format";
import { SLUG_TO_KIND, WALLET_UI } from "@/lib/wallets";

const TYPE: Record<string, string> = { opening: "Saldo awal", allocation: "Alokasi dana", transfer_in: "Transfer masuk", transfer_out: "Transfer keluar", expense: "Pengeluaran", purchase: "Pembelian stok", salary: "Gaji owner", withdrawal: "Penarikan owner", goal_use: "Pakai dana tujuan", internal_purchase: "Belanja internal", reversal: "Pembatalan" };
const ACTION: Record<string, { href: string; label: string }> = {
  capital: { href: "/pembelian", label: "Catat pembelian" }, operations: { href: "/pengeluaran", label: "Catat pengeluaran" },
  owner: { href: "/gaji", label: "Catat pembayaran" }, growth: { href: "/tumbuh", label: "Kelola tujuan" },
};

export default function DompetDetail() {
  const { slug } = useParams<{ slug: string }>();
  const kind = SLUG_TO_KIND[slug];
  if (!kind) notFound();
  const u = WALLET_UI[kind]; const I = u.icon;
  const w = useApi<any>("/wallets"); const t = useApi<any>(`/wallets/${kind}/transactions`);
  if (w.loading || t.loading) return <Loading />;
  if (w.error || t.error) return <ErrorState message={(w.error || t.error)!} onRetry={() => { w.reload(); t.reload(); }} />;
  const wal = w.data.wallets.find((x: any) => x.kind === kind);
  const a = ACTION[kind];
  return (
    <>
      <PageHeader title={`Dompet ${u.label}`} desc={u.purpose} action={<Link href={a.href} className="inline-flex min-h-[44px] items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">{a.label}</Link>} />
      <Card className={`mb-6 border-l-4 ${u.border}`}>
        <div className="flex items-center gap-2 text-sm text-ink-2"><span className={`rounded-md p-1.5 ${u.bg} ${u.text}`}><I className="h-4 w-4" aria-hidden /></span>Saldo saat ini</div>
        <div className="num mt-2 text-[30px] font-bold">{rp(wal.balance)}</div>
        <p className="mt-1 text-sm text-ink-2">Bulan ini: masuk <span className="num">{rp(wal.inflowMonth)}</span>, keluar <span className="num">{rp(wal.outflowMonth)}</span></p>
      </Card>
      <h2 className="mb-3 font-semibold">Riwayat transaksi</h2>
      <Table rows={t.data.transactions}
        empty={<Empty title="Belum ada alokasi dana untuk dompet ini" desc="Atur alokasi dari menu Alokasi Dana." />}
        cols={[
          { h: "Jenis", m: "title", cell: (r: any) => TYPE[r.type] ?? r.type },
          { h: "Tanggal", m: "sub", cell: (r: any) => `${tgl(r.created_at)} ${jam(r.created_at)}` },
          { h: "Catatan", m: "sub", cell: (r: any) => r.note ?? "" },
          { h: "Nominal", right: true, m: "right", cell: (r: any) => <span className={r.amount < 0 ? "text-bad" : "text-ok"}>{r.amount > 0 ? "+" : ""}{rp(r.amount)}</span> },
        ]} />
    </>
  );
}
