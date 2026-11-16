"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Table, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin / Pengelola", kasir: "Kasir" };

export default function Pengguna() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>("/business/users");
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: "", email: "", password: "", role: "kasir" });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api("/business/users", { body: f }); toast("Pengguna ditambahkan."); setOpen(false); setF({ name: "", email: "", password: "", role: "kasir" }); reload(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Pengguna" desc="Owner, admin, dan kasir yang bisa masuk ke warung ini. Kasir hanya melihat menu penjualan dan stok." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Tambah Pengguna</Button>} />
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table rows={data.users} empty={<p className="p-6 text-center text-sm text-ink-2">Belum ada pengguna.</p>}
          cols={[{ h: "Nama", m: "title", cell: (u: any) => <span className="font-medium">{u.name}</span> }, { h: "Email", m: "sub", cell: (u: any) => u.email }, { h: "Peran", m: "right", cell: (u: any) => ROLE[u.role] }]} />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Tambah pengguna">
        <div className="space-y-4">
          <Field label="Nama" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password awal" required hint="Minimal 8 karakter. Berikan ke pegawai secara langsung."><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Peran"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="kasir">Kasir</option><option value="admin">Admin / Pengelola</option></Select></Field>
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} onClick={save}>Tambah</Button></div>
        </div>
      </Modal>
    </>
  );
}
