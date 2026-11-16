"use client";
import { useState } from "react";
import { Badge, Button, Confirm, Empty, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Table, useToast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { jam, qty, rp, tgl } from "@/lib/format";
import { PAYMENT_LABEL } from "@warungflow/shared";

const pm = (m: string) => (PAYMENT_LABEL as any)[m] ?? (m === "owner_wallet" ? "Dompet Gaji" : m);

export default function Penjualan() {
  const me = useMe(); const toast = useToast();
  const [f, setF] = useState({ from: "", to: "", method: "", kind: "", status: "" });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(page) }).toString();
  const { data, loading, error, reload } = useApi<any>(`/sales?${qs}`);
  const [sel, setSel] = useState<string | null>(null);
  const detail = useApi<any>(sel ? `/sales/${sel}` : null);
  const [voidOpen, setVoidOpen] = useState(false); const [busy, setBusy] = useState(false);
  const canVoid = me.role !== "kasir";
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setPage(1); };

  const doVoid = async () => {
    setBusy(true);
    try { await api(`/sales/${sel}/void`, { body: {} }); toast("Transaksi dibatalkan."); setVoidOpen(false); setSel(null); reload(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <>
      <PageHeader title="Penjualan" desc="Riwayat semua transaksi. Pembatalan dicatat sebagai transaksi pembalik." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Field label="Dari tanggal"><Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} /></Field>
        <Field label="Sampai tanggal"><Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} /></Field>
        <Field label="Pembayaran"><Select value={f.method} onChange={(e) => set("method", e.target.value)}><option value="">Semua</option>{Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Jenis"><Select value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="">Semua</option><option value="external">Pelanggan</option><option value="internal">Internal</option></Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">Semua</option><option value="completed">Selesai</option><option value="voided">Dibatalkan</option></Select></Field>
      </div>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <Table rows={data.sales} onRow={(r: any) => setSel(r.id)}
            empty={<Empty title="Belum ada transaksi" desc="Transaksi dari menu Kasir akan muncul di sini." action={Object.values(f).some(Boolean) ? <Button variant="secondary" onClick={() => setF({ from: "", to: "", method: "", kind: "", status: "" })}>Reset filter</Button> : undefined} />}
            cols={[
              { h: "Nomor", m: "title", cell: (r: any) => r.number },
              { h: "Tanggal", m: "sub", cell: (r: any) => `${tgl(r.created_at)} ${jam(r.created_at)}` },
              { h: "Pembayaran", m: "sub", cell: (r: any) => pm(r.payment_method) },
              { h: "Jenis", m: "sub", cell: (r: any) => <Badge kind={r.kind} /> },
              { h: "Status", m: "sub", cell: (r: any) => <Badge kind={r.status} /> },
              { h: "Total", right: true, m: "right", cell: (r: any) => rp(r.total) },
            ]} />
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span className="text-ink-2">Halaman {page} dari {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          )}
        </>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Detail transaksi">
        {detail.loading || !detail.data ? <Loading /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><b>{detail.data.sale.number}</b><Badge kind={detail.data.sale.kind} /><Badge kind={detail.data.sale.status} /></div>
            <ul className="divide-y divide-line text-sm">{detail.data.items.map((i: any, n: number) => (
              <li key={n} className="flex justify-between py-2"><span>{i.product_name} <span className="text-ink-2">x {qty(i.quantity)}</span></span><span className="num">{rp(i.unit_price * i.quantity)}</span></li>))}</ul>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink-2">Diskon</dt><dd className="num">{rp(detail.data.sale.discount)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="num">{rp(detail.data.sale.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Pembayaran</dt><dd>{pm(detail.data.sale.payment_method)}</dd></div>
            </dl>
            {canVoid && detail.data.sale.status === "completed" && <Button variant="secondary" className="w-full text-bad" onClick={() => setVoidOpen(true)}>Batalkan transaksi</Button>}
          </div>
        )}
      </Modal>
      <Confirm open={voidOpen} onClose={() => setVoidOpen(false)} loading={busy} danger onConfirm={doVoid} confirmLabel="Ya, batalkan" title="Batalkan transaksi ini?">
        <p>Stok barang dikembalikan dan uang yang masuk dicatat sebagai pengembalian. Transaksi asli tetap tersimpan dengan status Dibatalkan.</p>
      </Confirm>
    </>
  );
}
