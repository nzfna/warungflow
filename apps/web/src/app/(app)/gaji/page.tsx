"use client";
import { useState } from "react";
import { Button, Card, Empty, ErrorState, Field, Input, Loading, Modal, MoneyInput, PageHeader, Select, Table, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { jam, rp, tgl } from "@/lib/format";

export default function Gaji() {
  const toast = useToast();
  const w = useApi<any>("/wallets"); const t = useApi<any>("/wallets/owner/transactions");
  const [open, setOpen] = useState(false); const [f, setF] = useState<any>({ kind: "salary", amount: "", method: "cash", note: "" });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (w.loading || t.loading) return <Loading />;
  if (w.error || t.error) return <ErrorState message={(w.error || t.error)!} onRetry={() => { w.reload(); t.reload(); }} />;
  const bal = w.data.wallets.find((x: any) => x.kind === "owner").balance;
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api("/wallets/payout", { body: { ...f, amount: Number(f.amount || 0), note: f.note || null } }); toast("Pembayaran owner dicatat."); setOpen(false); setF({ kind: "salary", amount: "", method: "cash", note: "" }); w.reload(); t.reload(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const rows = t.data.transactions.filter((r: any) => ["salary", "withdrawal", "allocation", "opening", "transfer_in", "transfer_out", "internal_purchase", "reversal"].includes(r.type));
  const L: Record<string, string> = { salary: "Gaji", withdrawal: "Penarikan pribadi", allocation: "Alokasi dana", opening: "Saldo awal", transfer_in: "Transfer masuk", transfer_out: "Transfer keluar", internal_purchase: "Belanja internal", reversal: "Pembatalan" };
  return (
    <>
      <PageHeader title="Gaji Owner" desc="Gaji berbeda dari pengeluaran operasional. Pembayaran dan penarikan pribadi dicatat di sini dan tidak mengurangi keuntungan usaha." action={<Button onClick={() => { setErr(null); setOpen(true); }}>Catat Pembayaran</Button>} />
      <Card className="mb-6 border-l-4 border-w-owner"><div className="text-sm text-ink-2">Saldo alokasi gaji</div><div className="num mt-1 text-[30px] font-bold">{rp(bal)}</div><p className="mt-1 text-xs text-ink-2">Alokasi gaji dan pembayaran aktual dicatat terpisah. Pembayaran tidak bisa melebihi saldo ini.</p></Card>
      <h2 className="mb-3 font-semibold">Riwayat</h2>
      <Table rows={rows} empty={<Empty title="Belum ada riwayat" desc="Alokasikan dana ke Dompet Gaji Owner lebih dulu." />}
        cols={[
          { h: "Jenis", m: "title", cell: (r: any) => L[r.type] },
          { h: "Tanggal", m: "sub", cell: (r: any) => `${tgl(r.created_at)} ${jam(r.created_at)}` },
          { h: "Catatan", m: "sub", cell: (r: any) => r.note ?? "" },
          { h: "Nominal", right: true, m: "right", cell: (r: any) => <span className={r.amount < 0 ? "text-bad" : "text-ok"}>{r.amount > 0 ? "+" : ""}{rp(r.amount)}</span> },
        ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="Catat pembayaran owner">
        <div className="space-y-4">
          <Field label="Jenis"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="salary">Gaji</option><option value="withdrawal">Penarikan pribadi</option></Select></Field>
          <Field label="Nominal" required hint={`Saldo tersedia ${rp(bal)}`}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <Field label="Diambil dari"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="cash">Kas tunai</option><option value="transfer">Rekening</option></Select></Field>
          <Field label="Catatan"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} disabled={!f.amount} onClick={save}>Simpan</Button></div>
        </div>
      </Modal>
    </>
  );
}
