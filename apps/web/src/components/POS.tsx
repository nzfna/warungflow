"use client";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2, CheckCircle2 } from "lucide-react";
import { Badge, Button, Confirm, Empty, Field, Loading, Modal, MoneyInput, Select, cx, useToast } from "./ui";
import { api } from "@/lib/api";
import { uuid, useApi } from "@/lib/hooks";
import { qty, rp } from "@/lib/format";
import { PAYMENT_LABEL, PaymentMethod } from "@warungflow/shared";

type P = { id: string; name: string; unit: string; sell_price: number; stock: number; category_id: string | null; stock_status: string };
type Line = { p: P; q: number };

export function POS({ internal = false }: { internal?: boolean }) {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ products: P[] }>("/products");
  const cats = useApi<{ categories: { id: string; name: string }[] }>("/categories");
  const [search, setSearch] = useState(""); const [cat, setCat] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [payFrom, setPayFrom] = useState<"cash" | "owner_wallet">("owner_wallet");
  const [received, setReceived] = useState<number | "">("");
  const [discount, setDiscount] = useState<number | "">("");
  const [sheet, setSheet] = useState(false); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [key, setKey] = useState(uuid());
  const [done, setDone] = useState<{ number: string; total: number; change: number } | null>(null);

  const products = useMemo(() => (data?.products ?? []).filter((p) =>
    (!cat || p.category_id === cat) && (!search || p.name.toLowerCase().includes(search.toLowerCase()))), [data, cat, search]);
  const subtotal = cart.reduce((a, l) => a + l.p.sell_price * l.q, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const cashOnly = !internal && method === "cash";
  const change = cashOnly ? Math.max(0, Number(received || 0) - total) : 0;
  const short = cashOnly && received !== "" && Number(received) < total;
  const count = cart.reduce((a, l) => a + l.q, 0);

  useEffect(() => { if (!cashOnly) setReceived(""); }, [cashOnly]);

  const add = (p: P) => setCart((c) => {
    const i = c.findIndex((l) => l.p.id === p.id);
    if (i >= 0) { const n = [...c]; if (n[i].q + 1 <= p.stock) n[i] = { ...n[i], q: n[i].q + 1 }; else toast(`Stok ${p.name} tinggal ${qty(p.stock)}.`, "err"); return n; }
    if (p.stock <= 0) { toast(`${p.name} sedang habis.`, "err"); return c; }
    return [...c, { p, q: 1 }];
  });
  const setQ = (id: string, q: number) => setCart((c) => c.flatMap((l) => l.p.id !== id ? [l] : q <= 0 ? [] : [{ ...l, q: Math.min(q, l.p.stock) }]));

  const pay = async () => {
    setBusy(true);
    try {
      const r = await api<any>("/sales/checkout", { idem: key, body: {
        items: cart.map((l) => ({ productId: l.p.id, quantity: l.q })), discount: Number(discount || 0),
        paymentMethod: internal ? "cash" : method, received: cashOnly ? Number(received || total) : undefined,
        kind: internal ? "internal" : "external", payFrom: internal ? payFrom : "cash",
      } });
      setDone({ number: r.number, total: r.total, change: r.change });
      setCart([]); setReceived(""); setDiscount(""); setConfirm(false); setSheet(false); setKey(uuid()); reload();
    } catch (e: any) { toast(e.message, "err"); setConfirm(false); }
    finally { setBusy(false); }
  };

  const cartPanel = (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><ShoppingCart className="h-4 w-4" />{internal ? "Barang yang diambil" : "Keranjang"}</h2>
      {cart.length === 0 ? <p className="flex-1 py-8 text-center text-sm text-ink-2">Keranjang masih kosong. Pilih produk untuk memulai.</p> : (
        <ul className="-mx-1 flex-1 divide-y divide-line overflow-y-auto px-1">
          {cart.map((l) => (
            <li key={l.p.id} className="py-2.5">
              <div className="flex justify-between gap-2"><span className="font-medium">{l.p.name}</span><span className="num font-semibold">{rp(l.p.sell_price * l.q)}</span></div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="num text-xs text-ink-2">{rp(l.p.sell_price)} / {l.p.unit}</span>
                <div className="flex items-center gap-1">
                  <button aria-label={`Kurangi ${l.p.name}`} onClick={() => setQ(l.p.id, l.q - 1)} className="flex h-9 w-9 items-center justify-center rounded-control border border-line hover:bg-muted"><Minus className="h-4 w-4" /></button>
                  <input aria-label={`Jumlah ${l.p.name}`} inputMode="decimal" value={l.q} onChange={(e) => setQ(l.p.id, Number(e.target.value.replace(",", ".")) || 0)} className="num h-9 w-12 rounded-control border border-line text-center" />
                  <button aria-label={`Tambah ${l.p.name}`} onClick={() => setQ(l.p.id, l.q + 1)} className="flex h-9 w-9 items-center justify-center rounded-control border border-line hover:bg-muted"><Plus className="h-4 w-4" /></button>
                  <button aria-label={`Hapus ${l.p.name}`} onClick={() => setQ(l.p.id, 0)} className="flex h-9 w-9 items-center justify-center rounded-control text-bad hover:bg-bad-bg"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 space-y-3 border-t border-line pt-3">
        <Field label="Diskon"><MoneyInput value={discount} onChange={setDiscount} /></Field>
        {internal ? (
          <Field label="Dibayar dari" hint={payFrom === "owner_wallet" ? "Saldo Dompet Gaji Owner dipindah ke Dompet Modal. Tidak dihitung sebagai penjualan." : "Uang masuk ke kas sebagai belanja internal, bukan penjualan pelanggan."}>
            <Select value={payFrom} onChange={(e) => setPayFrom(e.target.value as any)}><option value="owner_wallet">Dompet Gaji Owner</option><option value="cash">Tunai langsung</option></Select>
          </Field>
        ) : (
          <>
            <Field label="Metode pembayaran"><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            {cashOnly && <Field label="Uang diterima" error={short ? "Uang diterima kurang dari total." : null}><MoneyInput value={received} onChange={setReceived} /></Field>}
          </>
        )}
        <div className="flex items-baseline justify-between"><span className="text-ink-2">Total</span><span className="num text-[24px] font-bold">{rp(total)}</span></div>
        {cashOnly && received !== "" && !short && <div className="flex justify-between text-sm"><span className="text-ink-2">Kembalian</span><span className="num font-semibold text-ok">{rp(change)}</span></div>}
        <Button className="w-full" disabled={!cart.length || short} onClick={() => setConfirm(true)}>{internal ? "Catat belanja internal" : "Bayar"}</Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
      <div>
        <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input aria-label="Cari produk" placeholder="Cari nama produk" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[44px] w-full rounded-control border border-line bg-white pl-9 pr-3 focus:border-brand-600" /></div>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Kategori">
          {[{ id: "", name: "Semua" }, ...(cats.data?.categories ?? [])].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
              className={cx("min-h-[36px] shrink-0 rounded-full border px-4 text-sm font-medium", cat === c.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-2")}>{c.name}</button>
          ))}
        </div>
        {loading ? <Loading /> : products.length === 0 ? <Empty title="Belum ada produk" desc="Tambahkan barang yang dijual di menu Produk & Stok." /> : (
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const out = p.stock <= 0;
              return (
                <li key={p.id}><button disabled={out} onClick={() => add(p)}
                  className="flex min-h-[88px] w-full flex-col items-start justify-between rounded-card border border-line bg-white p-3 text-left hover:border-brand-600 disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-3">
                  <span className="line-clamp-2 font-medium">{p.name}</span>
                  <span className="mt-2 flex w-full items-end justify-between"><span className="num font-bold">{rp(p.sell_price)}</span>
                    {out ? <Badge kind="habis" /> : <span className={cx("num text-xs", p.stock_status === "menipis" ? "font-semibold text-warn" : "text-ink-2")}>{qty(p.stock)} {p.unit}</span>}</span>
                </button></li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="sticky top-[84px] hidden h-[calc(100vh-110px)] rounded-card border border-line bg-white p-4 lg:block">{cartPanel}</aside>

      {/* Mobile: bilah total + panel bawah */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-line bg-white p-3 lg:hidden">
        <Button className="w-full justify-between" disabled={!cart.length} onClick={() => setSheet(true)}><span>{count} barang</span><span className="num">{rp(total)} · Lihat keranjang</span></Button>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} title={internal ? "Belanja internal" : "Keranjang"}>{cartPanel}</Modal>

      <Confirm open={confirm} onClose={() => setConfirm(false)} loading={busy} onConfirm={pay} confirmLabel={internal ? "Catat" : "Simpan transaksi"}
        title={internal ? "Catat belanja internal?" : "Simpan transaksi?"}>
        <p>Total <b className="num text-ink">{rp(total)}</b>{!internal && <> dibayar <b className="text-ink">{PAYMENT_LABEL[method]}</b></>}{internal && <> dari <b className="text-ink">{payFrom === "owner_wallet" ? "Dompet Gaji Owner" : "tunai"}</b></>}.</p>
        <p>Stok {cart.length} jenis barang akan berkurang.{internal && " Transaksi ini diberi tanda Internal dan tidak masuk penjualan pelanggan."}</p>
      </Confirm>

      <Modal open={!!done} onClose={() => setDone(null)} title="Transaksi tersimpan">
        {done && <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-ok" aria-hidden />
          <p className="font-semibold">{done.number}</p>
          <p className="num text-[26px] font-bold">{rp(done.total)}</p>
          {done.change > 0 && <p className="text-sm">Kembalian <b className="num text-ok">{rp(done.change)}</b></p>}
          <Button className="w-full" onClick={() => setDone(null)}>{internal ? "Catat lagi" : "Transaksi baru"}</Button>
        </div>}
      </Modal>
    </div>
  );
}
