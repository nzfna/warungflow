"use client";
import { useEffect, useState } from "react";
import { Button, Card, ErrorState, Field, Input, Loading, MoneyInput, PageHeader, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function Pengaturan() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>("/business");
  const [f, setF] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ name: data.business.name, address: data.business.address, allowNegativeStock: data.business.allow_negative_stock, opsBudget: data.business.ops_budget }); }, [data]);
  if (loading || !f) return error ? <ErrorState message={error} onRetry={reload} /> : <Loading />;
  const save = async () => {
    setBusy(true);
    try { await api("/business", { method: "PATCH", body: { ...f, opsBudget: Number(f.opsBudget || 0) } }); toast("Pengaturan disimpan."); reload(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Pengaturan Warung" desc="Profil dan aturan dasar warung." />
      <Card className="max-w-xl space-y-4">
        <Field label="Nama warung" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Alamat"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Anggaran operasional per bulan" hint="Dipakai untuk peringatan di Dompet Operasional. Isi 0 jika tidak dipakai."><MoneyInput value={f.opsBudget} onChange={(v) => setF({ ...f, opsBudget: v })} /></Field>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.allowNegativeStock} onChange={(e) => setF({ ...f, allowNegativeStock: e.target.checked })} /><span><b>Izinkan stok minus</b><br /><span className="text-ink-2">Jika dimatikan, kasir tidak bisa menjual melebihi stok tercatat.</span></span></label>
        <div className="text-xs text-ink-2">Mata uang {data.business.currency} · Zona waktu {data.business.timezone}</div>
        <Button loading={busy} onClick={save}>Simpan pengaturan</Button>
      </Card>
    </>
  );
}
