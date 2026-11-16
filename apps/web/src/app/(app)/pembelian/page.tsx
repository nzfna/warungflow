"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Empty, ErrorState, Field, Input, Loading, Modal, MoneyInput, NumberInput, PageHeader, Select, Table, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { uuid, useApi } from "@/lib/hooks";
import { rp, tgl } from "@/lib/format";

type Item = { productId: string; quantity: number | ""; unitCost: number | "" };

export default function Pembelian() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>("/purchases");
  const sups = useApi<any>("/suppliers"); const prods = useApi<any>("/products");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(""); const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "", unitCost: "" }]);
  const [discount, setDiscount] = useState<number | "">(""); const [extra, setExtra] = useState<number | "">("");
  const [paid, setPaid] = useState<number | "">(""); const [method, setMethod] = useState("cash"); const [due, setDue] = useState(""); const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [key, setKey] = useState(uuid());
  const [pay, setPay] = useState<any | null>(null); const [payAmt, setPayAmt] = useState<number | "">("");

  const subtotal = items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.unitCost || 0), 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(extra || 0));
  const remaining = total - Number(paid || 0);
  const setItem = (n: number, patch: Partial<Item>) => setItems(items.map((it, i) => (i === n ? { ...it, ...patch } : it)));
  const pickProduct = (n: number, id: string) => { const p = prods.data?.products.find((x: any) => x.id === id); setItem(n, { productId: id, unitCost: p ? p.cost_price : "" }); };

  const reset = () => { setSupplierId(""); setItems([{ productId: "", quantity: "", unitCost: "" }]); setDiscount(""); setExtra(""); setPaid(""); setDue(""); setNote(""); setErr(null); setKey(uuid()); };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/purchases", { idem: key, body: {
        supplierId, items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost || 0) })),
        discount: Number(discount || 0), extraCost: Number(extra || 0), paidAmount: Number(paid || 0), paymentMethod: method, dueDate: remaining > 0 ? due || null : null, note: note || null } });
      toast("Pembelian tersimpan. Stok sudah bertambah."); setOpen(false); reset(); reload(); prods.reload(); sups.reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const doPay = async () => {
    setBusy(true);
    try { await api(`/purchases/${pay.id}/pay`, { body: { amount: Number(payAmt), method: "cash" } }); toast("Pembayaran supplier dicatat."); setPay(null); setPayAmt(""); reload(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Pembelian" desc="Catat barang masuk dari supplier. Stok bertambah, dan utang tercatat jika belum dibayar penuh." action={<Button onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4" />Catat Pembelian</Button>} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table rows={data.purchases} onRow={(r: any) => r.remaining > 0 && (setPay(r), setPayAmt(r.remaining))}
          empty={<Empty title="Belum ada pembelian" desc="Catat pembelian pertama setelah menambahkan supplier dan produk." />}
          cols={[
            { h: "Nomor", m: "title", cell: (r: any) => r.number },
            { h: "Supplier", m: "sub", cell: (r: any) => r.supplier },
            { h: "Tanggal", m: "sub", cell: (r: any) => tgl(r.created_at) },
            { h: "Status", m: "sub", cell: (r: any) => <Badge kind={r.status} /> },
            { h: "Sisa utang", right: true, m: "hide", cell: (r: any) => r.remaining > 0 ? rp(r.remaining) : "-" },
            { h: "Total", right: true, m: "right", cell: (r: any) => rp(r.total) },
          ]} />
      )}
      <p className="mt-3 text-xs text-ink-2">Pilih pembelian yang belum lunas untuk mencatat pembayaran.</p>

      <Modal open={open} onClose={() => setOpen(false)} title="Catat pembelian" wide>
        <div className="space-y-4">
          <Field label="Supplier" required><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Pilih supplier</option>{sups.data?.suppliers.filter((s: any) => s.active).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <div className="space-y-3">
            {items.map((it, n) => (
              <div key={n} className="grid grid-cols-[1fr_auto] gap-2 rounded-control border border-line p-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
                <Field label="Produk"><Select value={it.productId} onChange={(e) => pickProduct(n, e.target.value)}><option value="">Pilih produk</option>{prods.data?.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                <div className="col-span-2 grid grid-cols-2 gap-2 md:col-span-2"><Field label="Jumlah"><NumberInput value={it.quantity} onChange={(v) => setItem(n, { quantity: v })} /></Field><Field label="Harga beli"><MoneyInput value={it.unitCost} onChange={(v) => setItem(n, { unitCost: v })} /></Field></div>
                <button aria-label="Hapus baris" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== n))} className="row-start-1 flex h-11 w-11 items-center justify-center self-end rounded-control text-bad hover:bg-bad-bg disabled:opacity-30 md:row-start-auto"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setItems([...items, { productId: "", quantity: "", unitCost: "" }])}><Plus className="h-4 w-4" />Tambah produk</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Diskon"><MoneyInput value={discount} onChange={setDiscount} /></Field>
            <Field label="Biaya tambahan"><MoneyInput value={extra} onChange={setExtra} /></Field>
            <Field label="Dibayar sekarang" hint="Kosongkan jika belum dibayar (utang). Dibayar dari Dompet Modal."><MoneyInput value={paid} onChange={setPaid} /></Field>
            <Field label="Cara bayar"><Select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Tunai</option><option value="transfer">Transfer</option></Select></Field>
            {remaining > 0 && <Field label="Jatuh tempo sisa utang" required><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>}
          </div>
          <Field label="Catatan"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <dl className="space-y-1 rounded-control bg-muted p-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-2">Total pembelian</dt><dd className="num font-bold">{rp(total)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Dibayar</dt><dd className="num">{rp(paid || 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Menjadi utang supplier</dt><dd className="num font-semibold text-warn">{rp(Math.max(0, remaining))}</dd></div>
          </dl>
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} disabled={!supplierId || total <= 0} onClick={save}>Simpan pembelian</Button></div>
        </div>
      </Modal>

      <Modal open={!!pay} onClose={() => setPay(null)} title="Bayar utang supplier">
        {pay && <div className="space-y-4">
          <p className="text-sm text-ink-2">{pay.number} · {pay.supplier}<br />Sisa utang <b className="num text-ink">{rp(pay.remaining)}</b>. Pembayaran mengurangi Dompet Modal dan kas.</p>
          <Field label="Jumlah dibayar" required><MoneyInput value={payAmt} onChange={setPayAmt} /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPay(null)}>Batal</Button><Button loading={busy} disabled={!payAmt} onClick={doPay}>Catat pembayaran</Button></div>
        </div>}
      </Modal>
    </>
  );
}
