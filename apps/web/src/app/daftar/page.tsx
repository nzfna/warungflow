"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function Daftar() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/register", { body: f }); window.location.href = "/mulai"; }
    catch (x: any) { setErr(x.message); setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthFrame title="Buat akun WarungFlow" footer={<>Sudah punya akun? <Link className="font-semibold text-brand-700 hover:underline" href="/masuk">Masuk</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama kamu" required><Input autoComplete="name" value={f.name} onChange={set("name")} required /></Field>
        <Field label="Email" required><Input type="email" autoComplete="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Password" required hint="Minimal 8 karakter."><Input type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={8} /></Field>
        {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
        <Button type="submit" loading={busy} className="w-full">Buat akun</Button>
      </form>
    </AuthFrame>
  );
}
