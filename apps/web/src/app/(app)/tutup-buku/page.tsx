"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, Confirm, Empty, ErrorState, Field, Input, Loading, MoneyInput, PageHeader, Table, Textarea, useToast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { rp, tgl, todayJkt } from "@/lib/format";

export default function TutupBuku() {
  const me = useMe(); const toast = useToast();
  const [date, setDate] = useState(todayJkt());
  const p = useApi<any>(`/reports/closings/preview?date=${date}`);
  const hist = useApi<any>(me.role !== "kasir" ? "/reports/closings" : null);
  const [actual, setActual] = useState<number | "">(""); const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const diff = actual === "" || !p.data ? null : Number(actual) - p.data.expectedCash;

  const save = async () => {
    setBusy(true);
    try { await api("/reports/closings", { body: { date, actualCash: Number(actual), note: note || null } }); toast("Tutup buku tersimpan."); setConfirm(false); setActual(""); setNote(""); p.reload(); hist.reload(); }
    catch (e: any) { toast(e.message, "err"); setConfirm(false); } finally { setBusy(false); }
  };
  const row = (l: string, v: number, strong?: boolean) => <div className={`flex justify-between py-3 ${strong ? "font-bold" : ""}`}><dt className={strong ? "" : "text-ink-2"}>{l}</dt><dd className="num">{rp(v)}</dd></div>;

  return (
    <>
      <PageHeader title="Tutup Buku" desc="Cocokkan uang kas fisik di laci dengan catatan sistem. Hanya kas tunai yang dihitung." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 max-w-[220px]"><Field label="Tanggal"><Input type="date" value={date} max={todayJkt()} onChange={(e) => setDate(e.target.value)} /></Field></div>
          {p.loading ? <Loading /> : p.error || !p.data ? <ErrorState message={p.error ?? "Gagal memuat."} onRetry={p.reload} /> : p.data.closed ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-ok" />Tanggal ini sudah ditutup</p>
              <dl className="divide-y divide-line text-sm">{row("Kas menurut sistem", p.data.expectedCash)}{row("Kas aktual", p.data.closed.actual_cash)}{row("Selisih", p.data.closed.difference, true)}</dl>
              {p.data.closed.difference !== 0 && <p className="flex items-start gap-2 rounded-control bg-warn-bg p-3 text-sm text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Uang kas fisik berbeda {rp(Math.abs(p.data.closed.difference))} dari catatan. Catatan: {p.data.closed.note}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="divide-y divide-line text-sm">{row("Kas awal", p.data.openingCash)}{row("Uang masuk (tunai)", p.data.cashIn)}{row("Uang keluar (tunai)", p.data.cashOut)}{row("Kas menurut sistem", p.data.expectedCash, true)}</dl>
              {me.role === "kasir" ? <p className="rounded-control bg-brand-50 p-3 text-sm text-brand-700">Hitung uang di laci dan laporkan ke owner. Owner yang mengonfirmasi tutup buku.</p> : <>
                <Field label="Kas aktual (hasil hitung fisik)" required><MoneyInput value={actual} onChange={setActual} /></Field>
                {diff !== null && (diff === 0
                  ? <p className="flex items-center gap-2 rounded-control bg-ok-bg p-3 text-sm font-semibold text-ok"><CheckCircle2 className="h-4 w-4" />Kas cocok, tidak ada selisih.</p>
                  : <p role="alert" className="flex items-start gap-2 rounded-control bg-warn-bg p-3 text-sm font-semibold text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Uang kas fisik berbeda {rp(Math.abs(diff))} dari catatan ({diff < 0 ? "kurang" : "lebih"}).</p>)}
                <Field label="Catatan penyebab selisih" required={!!diff} hint={diff ? "Wajib diisi jika ada selisih." : undefined}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                {me.role === "owner" ? <Button className="w-full" disabled={actual === "" || (!!diff && !note.trim())} onClick={() => setConfirm(true)}>Konfirmasi tutup buku</Button> : <p className="text-xs text-ink-2">Hanya owner yang dapat mengonfirmasi tutup buku.</p>}
              </>}
            </div>
          )}
        </Card>
        {hist.data && <div><h2 className="mb-3 font-semibold">Riwayat tutup buku</h2>
          <Table rows={hist.data.closings} empty={<Empty title="Belum ada tutup buku" desc="Tutup buku pertama akan muncul di sini." />}
            cols={[
              { h: "Tanggal", m: "title", cell: (r: any) => tgl(r.closing_date) },
              { h: "Kas aktual", right: true, m: "sub", cell: (r: any) => rp(r.actual_cash) },
              { h: "Selisih", right: true, m: "right", cell: (r: any) => r.difference === 0 ? <Badge kind="lunas" label="Cocok" /> : <span className="text-warn">{rp(r.difference)}</span> },
            ]} /></div>}
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} loading={busy} onConfirm={save} confirmLabel="Ya, tutup buku" title={`Tutup buku ${tgl(date)}?`}>
        <p>Kas sistem {rp(p.data?.expectedCash)}, kas aktual {rp(actual || 0)}. {diff ? `Selisih ${rp(diff)} akan tersimpan dengan catatanmu.` : "Tidak ada selisih."}</p>
        <p>Transaksi sebelumnya tidak dihapus. Tanggal ini tidak bisa ditutup dua kali.</p>
      </Confirm>
    </>
  );
}
