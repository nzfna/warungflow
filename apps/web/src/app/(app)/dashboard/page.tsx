"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, Stat } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { useApi } from "@/lib/hooks";
import { jam, qty, rp, tgl } from "@/lib/format";
import { WALLET_UI } from "@/lib/wallets";
import { WALLET_KINDS } from "@warungflow/shared";

export default function Dashboard() {
  const me = useMe();
  const { data: d, error, loading, reload } = useApi<any>("/reports/dashboard");
  if (loading) return <Loading />;
  if (error || !d) return <ErrorState message={error ?? "Data belum bisa dimuat."} onRetry={reload} />;
  const manager = me.role !== "kasir";
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const empty = d.productCount === 0 && d.transactions === 0;

  return (
    <>
      <PageHeader title={`${greet}, ${me.user.name.split(" ")[0]}`} desc={`Ringkasan hari ini, ${tgl(d.date)}.`} />
      {empty && (
        <Card className="mb-6 border-brand-100 bg-brand-50">
          <p className="font-semibold text-brand-900">Belum ada produk.</p>
          <p className="mt-1 text-sm text-ink-2">Tambahkan barang yang dijual di warung, lalu catat penjualan pertama lewat menu Kasir.</p>
          <Link href="/produk" className="mt-3 inline-flex min-h-[44px] items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Tambah produk</Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Penjualan hari ini" value={rp(d.sales)} hint="Uang dari pelanggan hari ini" />
        <Stat label="Transaksi" value={d.transactions} />
        {manager && <Stat label="Keuntungan kotor" value={rp(d.grossProfit)} hint="Penjualan dikurangi modal barang" tone={d.grossProfit < 0 ? "bad" : undefined} />}
        {manager && <Stat label="Saldo kas dan rekening" value={rp(d.cashBalance)} hint="Bukan sama dengan keuntungan" />}
      </div>

      {manager && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">4 Dompet</h2><Link href="/dompet" className="text-sm font-medium text-brand-700 hover:underline">Lihat semua</Link></div>
            <ul className="divide-y divide-line">
              {WALLET_KINDS.map((k) => { const u = WALLET_UI[k]; const I = u.icon; return (
                <li key={k}><Link href={`/dompet/${u.slug}`} className="flex min-h-[48px] items-center justify-between gap-3 py-2 hover:bg-muted/50">
                  <span className="flex items-center gap-2"><span className={`rounded-md p-1.5 ${u.bg} ${u.text}`}><I className="h-4 w-4" aria-hidden /></span>{u.label}</span>
                  <span className="num font-semibold">{rp(d.wallets[k])}</span></Link></li>
              ); })}
            </ul>
            {d.unallocated > 0 && <p className="mt-3 rounded-control bg-accent-100 px-3 py-2 text-sm text-warn">Ada {rp(d.unallocated)} yang belum dialokasikan. <Link href="/alokasi" className="font-semibold underline">Atur alokasi</Link></p>}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Penjualan 7 hari terakhir</h2>
            <div className="h-48" role="img" aria-label="Grafik penjualan 7 hari terakhir">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.trend.map((t: any) => ({ ...t, label: t.date.slice(8) + "/" + t.date.slice(5, 7) }))}>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1e6 ? v / 1e6 + "jt" : v >= 1e3 ? v / 1e3 + "rb" : v)} />
                  <Tooltip formatter={(v: any) => [rp(v), "Penjualan"]} labelFormatter={(l) => `Tanggal ${l}`} />
                  <Bar dataKey="sales" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Stok menipis</h2><Link href="/produk?status=menipis" className="text-sm font-medium text-brand-700 hover:underline">Lihat semua</Link></div>
          {d.lowStock.length === 0 ? <p className="py-4 text-sm text-ink-2">Semua stok masih aman.</p> : (
            <ul className="divide-y divide-line">{d.lowStock.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between py-2.5"><span>{p.name}</span><span className="flex items-center gap-2"><span className="num text-sm text-ink-2">{qty(p.stock)} {p.unit}</span><Badge kind={Number(p.stock) <= 0 ? "habis" : "menipis"} /></span></li>
            ))}</ul>
          )}
        </Card>
        {manager ? (
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Tagihan supplier</h2><Link href="/pembelian" className="text-sm font-medium text-brand-700 hover:underline">Lihat semua</Link></div>
            {d.bills.length === 0 ? <p className="py-4 text-sm text-ink-2">Tidak ada tagihan yang perlu dibayar.</p> : (
              <ul className="divide-y divide-line">{d.bills.map((b: any) => (
                <li key={b.id} className="flex items-center justify-between py-2.5"><span>{b.supplier}<span className="block text-xs text-ink-2">Jatuh tempo {tgl(b.due_date)}</span></span><span className="num font-semibold">{rp(b.remaining)}</span></li>
              ))}</ul>
            )}
          </Card>
        ) : null}
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Aktivitas terbaru</h2>
        {d.recentSales.length === 0 ? <Empty title="Belum ada transaksi" desc="Penjualan yang kamu catat akan muncul di sini." /> : (
          <ul className="divide-y divide-line">{d.recentSales.map((s: any) => (
            <li key={s.number} className="flex items-center justify-between gap-3 py-2.5">
              <span><span className="font-medium">{s.number}</span> <span className="text-xs text-ink-2">{jam(s.created_at)}</span><span className="ml-2 inline-flex gap-1">{s.kind === "internal" && <Badge kind="internal" />}{s.status === "voided" && <Badge kind="voided" />}</span></span>
              <span className="num font-semibold">{rp(s.total)}</span>
            </li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
