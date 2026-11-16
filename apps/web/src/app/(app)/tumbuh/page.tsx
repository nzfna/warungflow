"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, Empty, ErrorState, Field, Input, Loading, Modal, MoneyInput, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { rp, tgl } from "@/lib/format";

export default function Tumbuh() {
  const me = useMe(); const toast = useToast();
  const w = useApi<any>("/wallets"); const g = useApi<any>("/goals");
  const [m, setM] = useState<{ type: "new" | "fund" | "use"; goal?: any } | null>(null);
  const [f, setF] = useState<any>({}); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (w.loading || g.loading) return <Loading />;
  if (w.error || g.error) return <ErrorState message={(w.error || g.error)!} onRetry={() => { w.reload(); g.reload(); }} />;
  const bal = w.data.wallets.find((x: any) => x.kind === "growth").balance;
  const marked = g.data.goals.reduce((a: number, x: any) => a + Number(x.saved_amount), 0);
  const open = (type: any, goal?: any) => { setM({ type, goal }); setF(type === "new" ? { name: "", targetAmount: "", deadline: "", kind: "growth" } : { amount: "", note: "" }); setErr(null); };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (m!.type === "new") await api("/goals", { body: { name: f.name, targetAmount: Number(f.targetAmount || 0), deadline: f.deadline || null, kind: f.kind } });
      if (m!.type === "fund") await api(`/goals/${m!.goal.id}/fund`, { body: { amount: Number(f.amount || 0) } });
      if (m!.type === "use") await api(`/goals/${m!.goal.id}/use`, { body: { amount: Number(f.amount || 0), note: f.note } });
      toast("Tersimpan."); setM(null); w.reload(); g.reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Dana Tumbuh" desc="Tabungan untuk dana darurat dan pengembangan warung. Setiap tujuan punya nama dan target yang jelas." action={<Button onClick={() => open("new")}><Plus className="h-4 w-4" />Tambah Tujuan</Button>} />
      <Card className="mb-6 border-l-4 border-w-growth">
        <div className="text-sm text-ink-2">Saldo Dompet Tumbuh</div><div className="num mt-1 text-[30px] font-bold">{rp(bal)}</div>
        <p className="mt-1 text-xs text-ink-2">Sudah ditandai untuk tujuan {rp(marked)} · belum ditandai {rp(bal - marked)}</p>
      </Card>
      {g.data.goals.length === 0 ? <div className="rounded-card border border-line bg-white"><Empty title="Belum ada tujuan" desc="Contoh: Ganti etalase, Dana darurat 3 bulan." action={<Button onClick={() => open("new")}>Tambah Tujuan</Button>} /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {g.data.goals.map((x: any) => {
            const pct = Math.min(100, Math.round((x.saved_amount / x.target_amount) * 100));
            return (
              <Card key={x.id}>
                <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{x.name}</h2><span className="rounded-md bg-w-growth-bg px-2 py-0.5 text-xs font-semibold text-w-growth">{x.kind === "emergency" ? "Dana darurat" : "Pengembangan"}</span></div>
                <div className="num mt-3 text-lg font-bold">{rp(x.saved_amount)} <span className="text-sm font-normal text-ink-2">dari {rp(x.target_amount)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${x.name}`}><div className="h-full bg-w-growth" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-xs text-ink-2">{pct}% tercapai{x.deadline ? ` · target ${tgl(x.deadline)}` : ""}</p>
                <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => open("fund", x)}>Tandai dana</Button>{me.role === "owner" && <Button size="sm" variant="secondary" onClick={() => open("use", x)}>Pakai dana</Button>}</div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={!!m} onClose={() => setM(null)} title={m?.type === "new" ? "Tambah tujuan" : m?.type === "fund" ? `Tandai dana: ${m.goal.name}` : `Pakai dana: ${m?.goal?.name}`}>
        {m && <div className="space-y-4">
          {m.type === "new" && <>
            <Field label="Nama tujuan" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Contoh: Ganti etalase" /></Field>
            <Field label="Target nominal" required><MoneyInput value={f.targetAmount} onChange={(v) => setF({ ...f, targetAmount: v })} /></Field>
            <Field label="Jenis"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="growth">Pengembangan usaha</option><option value="emergency">Dana darurat</option></Select></Field>
            <Field label="Tenggat" hint="Boleh dikosongkan."><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
          </>}
          {m.type !== "new" && <Field label="Nominal" required hint={m.type === "fund" ? "Menandai bagian saldo Dompet Tumbuh untuk tujuan ini. Uang tidak berpindah." : `Tersedia untuk tujuan ini ${rp(m.goal.saved_amount)}. Uang keluar dari kas.`}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>}
          {m.type === "use" && <Field label="Catatan penggunaan" required><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Contoh: bayar etalase baru" /></Field>}
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setM(null)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></div>
        </div>}
      </Modal>
    </>
  );
}
