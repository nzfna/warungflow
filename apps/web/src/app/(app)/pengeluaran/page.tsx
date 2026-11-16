"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Empty, ErrorState, Field, Input, Loading, Modal, MoneyInput, PageHeader, Select, Stat, Table, Textarea, useToast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { monthStartJkt, rp, tgl, todayJkt } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@warungflow/shared";
import { WALLET_UI } from "@/lib/wallets";

export default function Pengeluaran() {
  const me = useMe(); const toast = useToast();
  const [from, setFrom] = useState(monthStartJkt()); const [to, setTo] = useState(todayJkt()); const [cat, setCat] = useState(""); const [wal, setWal] = useState("");
  const qs = new URLSearchParams({ from, to, ...(cat ? { category: cat } : {}), ...(wal ? { wallet: wal } : {}) }).toString();
  const { data, loading, error, reload } = useApi<any>(`/expenses?${qs}`);
  const [open, setOpen] = useState(false);
  const blank = { category: "", amount: "" as number | "", spentOn: todayJkt(), walletKind: "operations", method: "cash", note: "" };
  const [f, setF] = useState<any>(blank); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api("/expenses", { body: { ...f, amount: Number(f.amount || 0), note: f.note || null } }); toast("Pengeluaran dicatat."); setOpen(false); setF(blank); reload(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Pengeluaran" desc="Biaya usaha seperti listrik, kresek, dan bensin. Gaji owner dicatat di menu Gaji Owner." action={<Button onClick={() => { setF(blank); setErr(null); setOpen(true); }}><Plus className="h-4 w-4" />Catat Pengeluaran</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Dari"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Sampai"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Kategori"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Semua</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Sumber dana"><Select value={wal} onChange={(e) => setWal(e.target.value)}><option value="">Semua</option><option value="operations">Operasional</option><option value="capital">Modal</option><option value="growth">Tumbuh</option></Select></Field>
      </div>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="mb-4 max-w-xs"><Stat label="Total pengeluaran periode ini" value={rp(data.total)} /></div>
          <Table rows={data.expenses} empty={<Empty title="Belum ada pengeluaran" desc="Catat biaya rutin warung agar keuntungan bersih terhitung benar." />}
            cols={[
              { h: "Keterangan", m: "title", cell: (r: any) => <>{r.category}{r.note && <span className="block text-xs text-ink-2">{r.note}</span>}</> },
              { h: "Tanggal", m: "sub", cell: (r: any) => tgl(r.spent_on) },
              { h: "Sumber dana", m: "sub", cell: (r: any) => `Dompet ${(WALLET_UI as any)[r.wallet_kind]?.label}` },
              { h: "Nominal", right: true, m: "right", cell: (r: any) => rp(r.amount) },
            ]} />
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Catat pengeluaran">
        <div className="space-y-4">
          <Field label="Kategori" required><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Pilih kategori</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Nominal" required><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal" required><Input type="date" value={f.spentOn} onChange={(e) => setF({ ...f, spentOn: e.target.value })} /></Field>
            <Field label="Cara bayar"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="cash">Tunai</option><option value="transfer">Transfer</option></Select></Field>
          </div>
          <Field label="Sumber dana" hint="Umumnya Dompet Operasional.">
            <Select value={f.walletKind} onChange={(e) => setF({ ...f, walletKind: e.target.value })}><option value="operations">Dompet Operasional</option><option value="capital">Dompet Modal</option>{me.role === "owner" && <option value="growth">Dompet Tumbuh</option>}</Select>
          </Field>
          <Field label="Catatan"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} onClick={save}>Simpan pengeluaran</Button></div>
        </div>
      </Modal>
    </>
  );
}
