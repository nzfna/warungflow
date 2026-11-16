"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button, Card, ErrorState, Field, Input, Loading, PageHeader, Stat, Table, Tabs } from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { addDays, downloadCsv, monthStartJkt, qty, rp, tgl, todayJkt } from "@/lib/format";

const PRESETS = [
  { id: "today", label: "Hari ini" }, { id: "yesterday", label: "Kemarin" }, { id: "week", label: "Minggu ini" }, { id: "month", label: "Bulan ini" }, { id: "custom", label: "Kustom" },
];
const TABS = [
  { id: "penjualan", label: "Penjualan" }, { id: "labarugi", label: "Laba rugi" }, { id: "kas", label: "Arus kas" },
  { id: "stok", label: "Persediaan & utang" }, { id: "biaya", label: "Pengeluaran" }, { id: "internal", label: "Transaksi internal" },
];

function range(p: string, custom: [string, string]): [string, string] {
  const t = todayJkt();
  if (p === "today") return [t, t];
  if (p === "yesterday") { const y = addDays(t, -1); return [y, y]; }
  if (p === "week") { const dow = (new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7; return [addDays(t, -dow), t]; }
  if (p === "month") return [monthStartJkt(), t];
  return custom;
}
const Hint = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-xs text-ink-2">{children}</p>;

export default function Laporan() {
  const [preset, setPreset] = useState("month"); const [custom, setCustom] = useState<[string, string]>([monthStartJkt(), todayJkt()]);
  const [tab, setTab] = useState("penjualan");
  const [from, to] = range(preset, custom);
  const { data: d, loading, error, reload } = useApi<any>(`/reports/summary?from=${from}&to=${to}`);

  const exportCsv = () => {
    if (!d) return;
    downloadCsv(`warungflow-${from}-sd-${to}.csv`, [
      ["Tanggal", "Penjualan", "Pengeluaran"], ...d.daily.map((r: any) => [r.date, r.sales, r.expenses]),
      [], ["Ringkasan"], ["Penjualan", d.omzet], ["Modal barang terjual", d.hpp], ["Keuntungan kotor", d.grossProfit], ["Pengeluaran", d.expenses], ["Kerugian barang", d.losses], ["Keuntungan bersih", d.netProfit],
    ]);
  };

  return (
    <>
      <PageHeader title="Laporan Keuangan" desc={`Periode ${tgl(from)} sampai ${tgl(to)}.`} action={<Button variant="secondary" onClick={exportCsv} disabled={!d}><Download className="h-4 w-4" />Ekspor CSV</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periode">
          {PRESETS.map((p) => <button key={p.id} aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} className={`min-h-[40px] rounded-full border px-4 text-sm font-medium ${preset === p.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-2"}`}>{p.label}</button>)}
        </div>
        {preset === "custom" && <div className="flex gap-2"><Field label="Dari"><Input type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} /></Field><Field label="Sampai"><Input type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} /></Field></div>}
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {loading ? <Loading /> : error || !d ? <ErrorState message={error ?? "Data belum bisa dimuat."} onRetry={reload} /> : (
        <>
          {tab === "penjualan" && <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Penjualan" value={rp(d.omzet)} hint="Uang dari pelanggan, belum dikurangi apa pun" />
              <Stat label="Transaksi" value={d.transactions} />
              <Stat label="Rata-rata per transaksi" value={rp(d.transactions ? d.omzet / d.transactions : 0)} />
              <Stat label="Modal barang terjual" value={rp(d.hpp)} hint="Harga modal barang yang laku (HPP)" />
            </div>
            <Card className="mt-5">
              <h2 className="mb-3 font-semibold">Penjualan dan pengeluaran per hari</h2>
              {d.daily.length < 3 ? <p className="text-sm text-ink-2">Data masih terlalu sedikit untuk grafik. Lihat tabel di bawah.</p> : (
                <div className="h-56" role="img" aria-label="Grafik penjualan dan pengeluaran harian">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={d.daily.map((r: any) => ({ ...r, label: r.date.slice(8) }))}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" /><XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} width={48} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1e6 ? v / 1e6 + "jt" : v >= 1e3 ? v / 1e3 + "rb" : v)} />
                    <Tooltip formatter={(v: any, n: any) => [rp(v), n]} labelFormatter={(l) => `Tanggal ${l}`} /><Legend />
                    <Bar dataKey="sales" name="Penjualan" fill="#2563EB" radius={[3, 3, 0, 0]} /><Bar dataKey="expenses" name="Pengeluaran" fill="#EA8A12" radius={[3, 3, 0, 0]} />
                  </BarChart></ResponsiveContainer>
                </div>)}
            </Card>
            <h2 className="mb-3 mt-6 font-semibold">Produk terlaris</h2>
            <Table rows={d.topProducts} empty={<p className="p-6 text-center text-sm text-ink-2">Belum ada data penjualan pada periode ini.</p>}
              cols={[{ h: "Produk", m: "title", cell: (r: any) => r.name }, { h: "Terjual", m: "sub", right: true, cell: (r: any) => qty(r.qty) }, { h: "Penjualan", right: true, m: "right", cell: (r: any) => rp(r.revenue) }]} />
          </>}

          {tab === "labarugi" && <Card>
            <h2 className="mb-3 font-semibold">Laba rugi sederhana</h2>
            <dl className="divide-y divide-line text-sm">
              {[["Penjualan", d.omzet, ""], ["Modal barang terjual (HPP)", -d.hpp, ""], ["Keuntungan kotor", d.grossProfit, "b"], ["Pengeluaran operasional", -d.expenses, ""], ["Kerugian barang rusak, kedaluwarsa, hilang", -d.losses, ""], ["Keuntungan bersih (sederhana)", d.netProfit, "b"]].map(([l, v, b]: any) => (
                <div key={l} className={`flex justify-between py-3 ${b ? "font-bold" : ""}`}><dt>{l}</dt><dd className={`num ${b && v < 0 ? "text-bad" : b ? "text-ok" : ""}`}>{rp(v)}</dd></div>))}
            </dl>
            <Hint>Pembelian stok bukan biaya. Modal baru dihitung ketika barang terjual. Gaji dan penarikan owner tidak dihitung sebagai biaya di sini. Belanja internal owner ({rp(d.internal.total)}) tidak termasuk penjualan.</Hint>
          </Card>}

          {tab === "kas" && <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Stat label="Uang masuk" value={rp(d.cashIn)} /><Stat label="Uang keluar" value={rp(d.cashOut)} /><Stat label="Selisih arus kas" value={rp(d.cashIn - d.cashOut)} tone={d.cashIn - d.cashOut < 0 ? "bad" : "ok"} /></div>
            <Hint>Arus kas adalah uang yang benar-benar masuk dan keluar. Pembelian kredit baru terhitung keluar saat dibayar. Arus kas tidak sama dengan keuntungan.</Hint>
          </>}

          {tab === "stok" && <>
            <div className="grid grid-cols-2 gap-3"><Stat label="Nilai persediaan" value={rp(d.inventoryValue)} hint="Stok saat ini x harga modal rata-rata" /><Stat label="Utang supplier" value={rp(d.supplierPayable)} hint="Belum dibayar, semua periode" /></div>
            <Hint>Rincian per supplier ada di menu Supplier, dan tagihan di menu Pembelian.</Hint>
          </>}

          {tab === "biaya" && <>
            <div className="mb-4 max-w-xs"><Stat label="Total pengeluaran" value={rp(d.expenses)} /></div>
            <Table rows={d.expensesByCategory} empty={<p className="p-6 text-center text-sm text-ink-2">Belum ada pengeluaran pada periode ini.</p>}
              cols={[{ h: "Kategori", m: "title", cell: (r: any) => r.category }, { h: "Total", right: true, m: "right", cell: (r: any) => rp(r.total) }]} />
            <div className="mt-4 max-w-xs"><Stat label="Kerugian barang" value={rp(d.losses)} hint="Rusak, kedaluwarsa, atau hilang (dipisah dari biaya operasional)" /></div>
          </>}

          {tab === "internal" && <>
            <div className="grid grid-cols-2 gap-3"><Stat label="Belanja internal owner" value={rp(d.internal.total)} hint={`${d.internal.transactions} transaksi`} /><Stat label="Penarikan dan gaji owner" value={rp(d.ownerPayouts)} /></div>
            <Hint>Belanja internal dicatat terpisah dari penjualan pelanggan sehingga tidak menambah omzet.</Hint>
          </>}
        </>
      )}
    </>
  );
}
