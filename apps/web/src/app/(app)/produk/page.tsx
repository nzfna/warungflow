"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Badge, Button, Empty, ErrorState, Field, Input, Loading, Modal, MoneyInput, NumberInput, PageHeader, Select, Table, Textarea, useToast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { jam, qty, rp, tgl } from "@/lib/format";
import { STOCK_ADJUST_LABEL, STOCK_ADJUST_TYPES } from "@warungflow/shared";

const MOVE: Record<string, string> = { initial: "Stok awal", purchase: "Pembelian", sale: "Penjualan", internal: "Belanja internal", damaged: "Rusak", expired: "Kedaluwarsa", lost: "Hilang", opname: "Stok opname", sale_return: "Retur penjualan" };
const blank = { name: "", sku: "", categoryId: "", unit: "pcs", costPrice: "" as number | "", sellPrice: "" as number | "", stock: "" as number | "", minStock: "" as number | "", supplierId: "", expiryDate: "" };

function Inner() {
  const me = useMe(); const toast = useToast();
  const sp = useSearchParams();
  const [search, setSearch] = useState(""); const [cat, setCat] = useState(""); const [status, setStatus] = useState(sp.get("status") ?? ""); const [archived, setArchived] = useState(false);
  const qs = new URLSearchParams({ ...(search ? { q: search } : {}), ...(cat ? { category: cat } : {}), ...(status ? { status } : {}), ...(archived ? { active: "false" } : {}) }).toString();
  const { data, loading, error, reload } = useApi<any>(`/products?${qs}`);
  const cats = useApi<any>("/categories"); const sups = useApi<any>(me.role !== "kasir" ? "/suppliers" : null);
  const manage = me.role !== "kasir";

  const [form, setForm] = useState<any | null>(null); const [editId, setEditId] = useState<string | null>(null);
  const [errs, setErrs] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null); const det = useApi<any>(detail ? `/products/${detail}` : null);
  const [adj, setAdj] = useState<any | null>(null);
  const [newCat, setNewCat] = useState("");

  const openNew = () => { setForm({ ...blank }); setEditId(null); setErrs(null); };
  const openEdit = (p: any) => { setForm({ name: p.name, sku: p.sku ?? "", categoryId: p.category_id ?? "", unit: p.unit, costPrice: p.cost_price, sellPrice: p.sell_price, stock: p.stock, minStock: p.min_stock, supplierId: p.supplier_id ?? "", expiryDate: p.expiry_date ?? "" }); setEditId(p.id); setErrs(null); };

  const save = async () => {
    setBusy(true); setErrs(null);
    const body: any = { name: form.name, sku: form.sku || null, categoryId: form.categoryId || null, unit: form.unit || "pcs", costPrice: Number(form.costPrice || 0), sellPrice: Number(form.sellPrice || 0),
      minStock: Number(form.minStock || 0), supplierId: form.supplierId || null, expiryDate: form.expiryDate || null };
    if (!editId) body.stock = Number(form.stock || 0);
    try {
      if (editId) await api(`/products/${editId}`, { method: "PATCH", body }); else await api("/products", { body });
      toast(editId ? "Produk diperbarui." : "Produk ditambahkan."); setForm(null); reload();
    } catch (e: any) { setErrs(e.message); } finally { setBusy(false); }
  };
  const archive = async (p: any) => { try { await api(`/products/${p.id}/archive`, { body: { active: !p.active } }); toast(p.active ? "Produk diarsipkan." : "Produk diaktifkan lagi."); setDetail(null); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const doAdjust = async () => {
    setBusy(true);
    try {
      await api(`/products/${adj.id}/adjust`, { body: { type: adj.type, quantity: Number(adj.qty || 0) || 1, newStock: adj.type === "opname" ? Number(adj.newStock) : undefined, reason: adj.reason } });
      toast("Stok disesuaikan."); setAdj(null); reload(); if (detail) det.reload();
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const addCat = async () => { if (!newCat.trim()) return; try { const r = await api<any>("/categories", { body: { name: newCat } }); setNewCat(""); await cats.reload(); setForm((f: any) => ({ ...f, categoryId: r.category.id })); } catch (e: any) { toast(e.message, "err"); } };
  const f = (k: string) => (v: any) => setForm({ ...form, [k]: v });
  const p = det.data?.product;

  return (
    <>
      <PageHeader title="Produk & Stok" desc="Katalog barang, harga, dan jumlah stok." action={manage && <Button onClick={openNew}><Plus className="h-4 w-4" />Tambah Produk</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px_200px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><input aria-label="Cari produk" placeholder="Cari nama atau kode produk" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[44px] w-full rounded-control border border-line bg-white pl-9 pr-3" /></div>
        <Select aria-label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Semua kategori</option>{cats.data?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select aria-label="Status stok" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua stok</option><option value="menipis">Stok menipis</option><option value="habis">Habis</option></Select>
        {manage && <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="h-4 w-4" />Diarsipkan</label>}
      </div>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table rows={data.products} onRow={(r: any) => setDetail(r.id)}
          empty={<Empty title="Belum ada produk" desc="Tambahkan barang yang dijual di warung." action={manage ? <Button onClick={openNew}>Tambah Produk</Button> : undefined} />}
          cols={[
            { h: "Produk", m: "title", cell: (r: any) => <span className="font-medium">{r.name}</span> },
            { h: "Kategori", m: "sub", cell: (r: any) => r.category ?? "-" },
            { h: "Stok", right: true, m: "sub", cell: (r: any) => `${qty(r.stock)} ${r.unit}` },
            ...(manage ? [{ h: "Harga modal", right: true, m: "hide" as const, cell: (r: any) => rp(r.cost_price) }] : []),
            { h: "Harga jual", right: true, m: "right" as const, cell: (r: any) => rp(r.sell_price) },
            { h: "Status", m: "sub" as const, cell: (r: any) => r.active ? <Badge kind={r.stock_status} /> : <Badge kind="arsip" /> },
          ]} />
      )}

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={p?.name ?? "Detail produk"} wide>
        {!p ? <Loading /> : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><dt className="text-ink-2">Stok</dt><dd className="num text-lg font-bold">{qty(p.stock)} {p.unit}</dd></div>
              <div><dt className="text-ink-2">Batas minimum</dt><dd className="num font-semibold">{qty(p.min_stock)}</dd></div>
              {manage && <div><dt className="text-ink-2">Harga modal</dt><dd className="num font-semibold">{rp(p.cost_price)}</dd></div>}
              <div><dt className="text-ink-2">Harga jual</dt><dd className="num font-semibold">{rp(p.sell_price)}</dd></div>
            </dl>
            {manage && <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setDetail(null); openEdit(p); }}>Ubah info</Button><Button variant="secondary" onClick={() => setAdj({ id: p.id, name: p.name, type: "opname", qty: "", newStock: p.stock, reason: "" })}>Sesuaikan stok</Button><Button variant="ghost" onClick={() => archive(p)}>{p.active ? "Arsipkan" : "Aktifkan lagi"}</Button></div>}
            <div><h3 className="mb-2 font-semibold">Riwayat stok</h3>
              {det.data.movements.length === 0 ? <p className="text-sm text-ink-2">Belum ada pergerakan stok.</p> : (
                <ul className="divide-y divide-line text-sm">{det.data.movements.map((m: any, i: number) => (
                  <li key={i} className="flex justify-between gap-3 py-2"><span>{MOVE[m.type] ?? m.type}<span className="block text-xs text-ink-2">{tgl(m.created_at)} {jam(m.created_at)}{m.reason ? ` · ${m.reason}` : ""}</span></span><span className={`num font-semibold ${m.quantity < 0 ? "text-bad" : "text-ok"}`}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</span></li>))}</ul>)}
            </div>
            {manage && det.data.prices.length > 1 && <div><h3 className="mb-2 font-semibold">Riwayat harga</h3><ul className="divide-y divide-line text-sm">{det.data.prices.map((h: any, i: number) => <li key={i} className="flex justify-between py-2"><span className="text-ink-2">{tgl(h.created_at)}</span><span className="num">Modal {rp(h.cost_price)} · Jual {rp(h.sell_price)}</span></li>)}</ul></div>}
          </div>
        )}
      </Modal>

      {/* Form tambah/ubah */}
      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? "Ubah produk" : "Tambah produk"}>
        {form && <div className="space-y-4">
          <Field label="Nama produk" required><Input value={form.name} onChange={(e) => f("name")(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kode / SKU"><Input value={form.sku} onChange={(e) => f("sku")(e.target.value)} /></Field>
            <Field label="Satuan" required><Input value={form.unit} onChange={(e) => f("unit")(e.target.value)} placeholder="pcs, kg, liter" /></Field>
          </div>
          <Field label="Kategori"><Select value={form.categoryId} onChange={(e) => f("categoryId")(e.target.value)}><option value="">Tanpa kategori</option>{cats.data?.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div className="flex gap-2"><Input aria-label="Kategori baru" placeholder="Kategori baru" value={newCat} onChange={(e) => setNewCat(e.target.value)} /><Button variant="secondary" onClick={addCat}>Tambah</Button></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Harga modal" required><MoneyInput value={form.costPrice} onChange={f("costPrice")} /></Field>
            <Field label="Harga jual" required><MoneyInput value={form.sellPrice} onChange={f("sellPrice")} /></Field>
            {!editId && <Field label="Stok awal"><NumberInput value={form.stock} onChange={f("stock")} /></Field>}
            <Field label="Batas minimum stok"><NumberInput value={form.minStock} onChange={f("minStock")} /></Field>
          </div>
          {sups.data && <Field label="Supplier utama"><Select value={form.supplierId} onChange={(e) => f("supplierId")(e.target.value)}><option value="">Belum dipilih</option>{sups.data.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
          <Field label="Tanggal kedaluwarsa" hint="Isi jika relevan."><Input type="date" value={form.expiryDate} onChange={(e) => f("expiryDate")(e.target.value)} /></Field>
          {editId && <p className="text-xs text-ink-2">Untuk mengubah jumlah stok, gunakan Sesuaikan stok agar tercatat alasannya.</p>}
          {errs && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{errs}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></div>
        </div>}
      </Modal>

      {/* Penyesuaian stok */}
      <Modal open={!!adj} onClose={() => setAdj(null)} title={`Sesuaikan stok: ${adj?.name ?? ""}`}>
        {adj && <div className="space-y-4">
          <Field label="Jenis penyesuaian"><Select value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value })}>{STOCK_ADJUST_TYPES.map((t) => <option key={t} value={t}>{STOCK_ADJUST_LABEL[t]}</option>)}</Select></Field>
          {adj.type === "opname" ? <Field label="Stok hasil hitung fisik" required><NumberInput value={adj.newStock} onChange={(v) => setAdj({ ...adj, newStock: v })} /></Field>
            : <Field label="Jumlah yang berkurang" required hint="Dihitung sebagai kerugian sebesar harga modal."><NumberInput value={adj.qty} onChange={(v) => setAdj({ ...adj, qty: v })} /></Field>}
          <Field label="Alasan" required><Textarea rows={2} value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Contoh: kemasan sobek saat dibongkar" /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdj(null)}>Batal</Button><Button loading={busy} onClick={doAdjust}>Simpan penyesuaian</Button></div>
        </div>}
      </Modal>
    </>
  );
}
export default function Produk() { return <Suspense fallback={<Loading />}><Inner /></Suspense>; }
