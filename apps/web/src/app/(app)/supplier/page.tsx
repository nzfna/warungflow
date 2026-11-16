"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Empty, ErrorState, Field, Input, Loading, Modal, PageHeader, Table, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { rp } from "@/lib/format";

export default function Supplier() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>("/suppliers");
  const [f, setF] = useState<any | null>(null); const [id, setId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const open = (s?: any) => { setF(s ? { name: s.name, phone: s.phone ?? "", address: s.address ?? "", note: s.note ?? "" } : { name: "", phone: "", address: "", note: "" }); setId(s?.id ?? null); setErr(null); };
  const save = async () => {
    setBusy(true); setErr(null);
    try { if (id) await api(`/suppliers/${id}`, { method: "PATCH", body: f }); else await api("/suppliers", { body: f }); toast("Supplier disimpan."); setF(null); reload(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const payable = data ? data.suppliers.reduce((a: number, s: any) => a + Number(s.payable), 0) : 0;
  return (
    <>
      <PageHeader title="Supplier" desc={payable > 0 ? `Total utang supplier ${rp(payable)}.` : "Daftar pemasok barang warung."} action={<Button onClick={() => open()}><Plus className="h-4 w-4" />Tambah Supplier</Button>} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table rows={data.suppliers} onRow={open}
          empty={<Empty title="Belum ada supplier" desc="Tambahkan supplier sebelum mencatat pembelian stok." action={<Button onClick={() => open()}>Tambah Supplier</Button>} />}
          cols={[
            { h: "Supplier", m: "title", cell: (s: any) => <span className="font-medium">{s.name}</span> },
            { h: "Telepon", m: "sub", cell: (s: any) => s.phone || "-" },
            { h: "Pembelian", right: true, m: "sub", cell: (s: any) => `${s.purchase_count}x` },
            { h: "Utang", right: true, m: "right", cell: (s: any) => s.payable > 0 ? <span className="text-warn">{rp(s.payable)}</span> : <Badge kind="lunas" /> },
          ]} />
      )}
      <Modal open={!!f} onClose={() => setF(null)} title={id ? "Ubah supplier" : "Tambah supplier"}>
        {f && <div className="space-y-4">
          <Field label="Nama supplier" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Nomor telepon"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Alamat"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Field label="Catatan"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setF(null)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></div>
        </div>}
      </Modal>
    </>
  );
}
