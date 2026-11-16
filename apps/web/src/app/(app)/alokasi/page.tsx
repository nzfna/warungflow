"use client";
import { useState } from "react";
import { Button, Card, Confirm, ErrorState, Field, Input, Loading, Modal, MoneyInput, PageHeader, Select, Table, Textarea, cx, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { monthStartJkt, rp, tgl, todayJkt } from "@/lib/format";
import { WALLET_UI } from "@/lib/wallets";
import { WALLET_KINDS, WalletKind } from "@warungflow/shared";

const BASES = ["Laba bersih bulan lalu", "Laba kotor", "Nominal tetap", "Setoran modal tambahan", "Lainnya"];

export default function Alokasi() {
  const toast = useToast();
  const w = useApi<any>("/wallets"); const hist = useApi<any>("/wallets-allocations");
  const rep = useApi<any>(`/reports/summary?from=${monthStartJkt()}&to=${todayJkt()}`);
  const [amounts, setAmounts] = useState<Record<WalletKind, number | "">>({ capital: "", operations: "", owner: "", growth: "" });
  const [basis, setBasis] = useState(BASES[0]); const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const [tr, setTr] = useState<any | null>(null);
  const total = WALLET_KINDS.reduce((a, k) => a + Number(amounts[k] || 0), 0);
  if (w.loading) return <Loading />;
  if (w.error || !w.data) return <ErrorState message={w.error ?? "Data belum bisa dimuat."} onRetry={w.reload} />;
  const avail = Math.max(0, w.data.unallocated); const left = avail - total;

  const save = async () => {
    setBusy(true);
    try { await api("/wallets/allocate", { body: { basis, amounts: Object.fromEntries(WALLET_KINDS.map((k) => [k, Number(amounts[k] || 0)])), note: note || null } });
      toast("Alokasi dana tersimpan."); setAmounts({ capital: "", operations: "", owner: "", growth: "" }); setNote(""); setConfirm(false); w.reload(); hist.reload(); }
    catch (e: any) { toast(e.message, "err"); setConfirm(false); } finally { setBusy(false); }
  };
  const doTransfer = async () => {
    setBusy(true);
    try { await api("/wallets/transfer", { body: { from: tr.from, to: tr.to, amount: Number(tr.amount), note: tr.note || null } }); toast("Transfer antar-dompet dicatat."); setTr(null); w.reload(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Alokasi Dana" desc="Bagi uang usaha yang belum dialokasikan ke empat dompet. Angkanya kamu tentukan sendiri; tidak ada persentase baku." action={<Button variant="secondary" onClick={() => setTr({ from: "capital", to: "growth", amount: "", note: "" })}>Pindah antar-dompet</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="mb-4 rounded-control bg-brand-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">Dana yang bisa dialokasikan</span><b className="num">{rp(avail)}</b></div>
            <p className="mt-1 text-xs text-ink-2">Yaitu total kas dan rekening dikurangi saldo semua dompet. Sebagai bahan pertimbangan, keuntungan kotor bulan ini {rp(rep.data?.grossProfit ?? 0)} dan keuntungan bersih sederhana {rp(rep.data?.netProfit ?? 0)} (belum tentu sama dengan uang yang tersedia).</p>
          </div>
          <div className="space-y-4">
            <Field label="Dasar perhitungan"><Select value={basis} onChange={(e) => setBasis(e.target.value)}>{BASES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            {WALLET_KINDS.map((k) => {
              const n = Number(amounts[k] || 0); const pct = total > 0 ? Math.round((n / total) * 100) : 0;
              return <Field key={k} label={`Dompet ${WALLET_UI[k].label}`} hint={n > 0 ? `${pct}% dari total yang dialokasikan sekarang` : WALLET_UI[k].purpose}><MoneyInput value={amounts[k]} onChange={(v) => setAmounts({ ...amounts, [k]: v })} /></Field>;
            })}
            <Field label="Catatan"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <dl className="space-y-1 rounded-control bg-muted p-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-2">Total dialokasikan</dt><dd className="num font-bold">{rp(total)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Sisa belum dialokasikan</dt><dd className={cx("num font-semibold", left < 0 && "text-bad")}>{rp(left)}</dd></div>
            </dl>
            {left < 0 && <p role="alert" className="text-sm text-bad">Total melebihi dana yang tersedia. Kurangi nominal.</p>}
            <Button className="w-full" disabled={total <= 0 || left < 0} onClick={() => setConfirm(true)}>Simpan alokasi</Button>
          </div>
        </Card>
        <div>
          <h2 className="mb-3 font-semibold">Riwayat alokasi</h2>
          {hist.data && <Table rows={hist.data.allocations} empty={<p className="p-6 text-center text-sm text-ink-2">Belum ada alokasi dana untuk periode ini.</p>}
            cols={[
              { h: "Tanggal", m: "title", cell: (r: any) => tgl(r.created_at) },
              { h: "Dasar", m: "sub", cell: (r: any) => r.basis },
              { h: "Total", right: true, m: "right", cell: (r: any) => rp(r.total) },
            ]} />}
        </div>
      </div>

      <Confirm open={confirm} onClose={() => setConfirm(false)} loading={busy} onConfirm={save} confirmLabel="Ya, alokasikan" title="Simpan alokasi dana?">
        <p>Total <b className="num text-ink">{rp(total)}</b> dibagi ke dompet. Total kas usaha tidak berubah, hanya pembagiannya. Dasar: {basis}.</p>
        <ul className="divide-y divide-line">{WALLET_KINDS.filter((k) => Number(amounts[k] || 0) > 0).map((k) => <li key={k} className="flex justify-between py-1.5"><span>Dompet {WALLET_UI[k].label}</span><span className="num font-semibold text-ink">{rp(amounts[k])}</span></li>)}</ul>
      </Confirm>

      <Modal open={!!tr} onClose={() => setTr(null)} title="Pindah antar-dompet">
        {tr && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari"><Select value={tr.from} onChange={(e) => setTr({ ...tr, from: e.target.value })}>{WALLET_KINDS.map((k) => <option key={k} value={k}>{WALLET_UI[k].label}</option>)}</Select></Field>
            <Field label="Ke"><Select value={tr.to} onChange={(e) => setTr({ ...tr, to: e.target.value })}>{WALLET_KINDS.map((k) => <option key={k} value={k}>{WALLET_UI[k].label}</option>)}</Select></Field>
          </div>
          <Field label="Nominal" required hint="Memindahkan alokasi tidak mengubah total kas."><MoneyInput value={tr.amount} onChange={(v) => setTr({ ...tr, amount: v })} /></Field>
          <Field label="Catatan"><Input value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setTr(null)}>Batal</Button><Button loading={busy} disabled={!tr.amount || tr.from === tr.to} onClick={doTransfer}>Pindahkan</Button></div>
        </div>}
      </Modal>
    </>
  );
}
