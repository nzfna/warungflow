"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function Masuk() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/login", { body: { email, password } }); window.location.href = "/dashboard"; }
    catch (x: any) { setErr(x.message); setBusy(false); }
  };
  return (
    <AuthFrame title="Masuk ke WarungFlow" footer={<>Belum punya akun? <Link className="font-semibold text-brand-700 hover:underline" href="/daftar">Daftar</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" required><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password" required><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
        <Button type="submit" loading={busy} className="w-full">Masuk</Button>
        <p className="text-center text-xs text-ink-2">Lupa password? Minta owner warung untuk membuat akun baru.</p>
      </form>
    </AuthFrame>
  );
}
