"use client";
import Link from "next/link";
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { useApi } from "@/lib/hooks";
import { rp } from "@/lib/format";
import { WALLET_UI } from "@/lib/wallets";
import { WALLET_KINDS } from "@warungflow/shared";

export default function Dompet() {
  const me = useMe();
  const { data: d, loading, error, reload } = useApi<any>("/wallets");
  if (loading) return <Loading />;
  if (error || !d) return <ErrorState message={error ?? "Data belum bisa dimuat."} onRetry={reload} />;
  return (
    <>
      <PageHeader title="4 Dompet" desc="Dompet adalah pembagian dana usaha, bukan rekening bank. Saldonya dicatat dari transaksi dan bisa dicocokkan dengan kas lewat Tutup Buku."
        action={me.role === "owner" && <Link href="/alokasi" className="inline-flex min-h-[44px] items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Atur Alokasi</Link>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="!p-4"><div className="text-xs text-ink-2">Total uang usaha (kas dan rekening)</div><div className="num mt-1 text-[22px] font-bold">{rp(d.totalFunds)}</div></Card>
        <Card className="!p-4"><div className="text-xs text-ink-2">Sudah masuk dompet</div><div className="num mt-1 text-[22px] font-bold">{rp(d.allocated)}</div></Card>
        <Card className="!p-4"><div className="text-xs text-ink-2">Belum dialokasikan</div><div className="num mt-1 text-[22px] font-bold">{rp(d.unallocated)}</div>{d.unallocated < 0 && <div className="mt-1"><Badge kind="jatuh_tempo" label="Perlu dicek" /></div>}</Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {WALLET_KINDS.map((k) => {
          const u = WALLET_UI[k]; const I = u.icon; const w = d.wallets.find((x: any) => x.kind === k);
          return (
            <section key={k} className={`rounded-card border border-line border-l-4 ${u.border} bg-white p-5`}>
              <div className="flex items-center gap-2"><span className={`rounded-md p-1.5 ${u.bg} ${u.text}`}><I className="h-5 w-5" aria-hidden /></span><h2 className="font-semibold">Dompet {u.label}</h2></div>
              <p className="mt-1 text-sm text-ink-2">{u.purpose}</p>
              <div className="num mt-4 text-[26px] font-bold">{rp(w.balance)}</div>
              <p className="mt-1 text-xs text-ink-2">Bulan ini: masuk <span className="num">{rp(w.inflowMonth)}</span> · keluar <span className="num">{rp(w.outflowMonth)}</span></p>
              {k === "operations" && d.opsBudget > 0 && <p className={`mt-1 text-xs ${d.opsSpentMonth > d.opsBudget ? "font-semibold text-bad" : "text-ink-2"}`}>Anggaran bulan ini {rp(d.opsBudget)}, terpakai {rp(d.opsSpentMonth)}{d.opsSpentMonth > d.opsBudget ? " (melewati anggaran)" : ""}</p>}
              <Link href={`/dompet/${u.slug}`} className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 hover:underline">Lihat detail</Link>
            </section>
          );
        })}
      </div>
    </>
  );
}
