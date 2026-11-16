"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Card, Field, Input, MoneyInput, ToastProvider, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { rp } from "@/lib/format";
import { WALLET_UI } from "@/lib/wallets";
import { WALLET_KINDS, WalletKind } from "@warungflow/shared";

const STEPS = ["Profil warung", "Saldo kas", "Isi dompet", "Selesai"];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  const [cash, setCash] = useState<number | "">(0);
  const [alloc, setAlloc] = useState<Record<WalletKind, number | "">>({ capital: 0, operations: 0, owner: 0, growth: 0 });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const allocated = WALLET_KINDS.reduce((a, k) => a + Number(alloc[k] || 0), 0);
  const left = Number(cash || 0) - allocated;

  const next = () => {
    setErr(null);
    if (step === 0 && name.trim().length < 2) return setErr("Isi nama warung minimal 2 huruf.");
    if (step === 2 && left < 0) return setErr("Total isi dompet melebihi saldo kas.");
    setStep(step + 1);
  };
  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/business/setup", { body: {
        name, address, openingCash: Number(cash || 0),
        initialAllocation: Object.fromEntries(WALLET_KINDS.map((k) => [k, Number(alloc[k] || 0)])),
      } });
      window.location.href = "/dashboard";
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <ToastProvider>
      <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
        <h1 className="text-[24px] font-bold text-brand-900">Siapkan warung kamu</h1>
        <ol className="my-6 flex gap-2" aria-label="Langkah">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className={cx("h-1.5 rounded-full", i <= step ? "bg-brand-600" : "bg-line")} />
              <div className={cx("mt-1.5 flex items-center gap-1 text-xs font-medium", i === step ? "text-brand-700" : "text-ink-2")}>{i < step && <Check className="h-3 w-3" />}{s}</div>
            </li>
          ))}
        </ol>
        <Card className="space-y-4">
          {step === 0 && <>
            <Field label="Nama warung" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Warung Bu Sari" /></Field>
            <Field label="Alamat" hint="Boleh dikosongkan."><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          </>}
          {step === 1 && <>
            <p className="text-sm text-ink-2">Berapa uang usaha yang ada sekarang, di laci dan rekening? Ini jadi titik awal pencatatan kas.</p>
            <Field label="Saldo awal kas"><MoneyInput value={cash} onChange={setCash} /></Field>
          </>}
          {step === 2 && <>
            <p className="text-sm text-ink-2">Bagi saldo awal ke empat dompet sesuai kebutuhan. Kamu bisa melewati langkah ini dan mengaturnya nanti di menu Alokasi Dana.</p>
            {WALLET_KINDS.map((k) => (
              <Field key={k} label={`Dompet ${WALLET_UI[k].label}`} hint={WALLET_UI[k].purpose}><MoneyInput value={alloc[k]} onChange={(v) => setAlloc({ ...alloc, [k]: v })} /></Field>
            ))}
            <div className={cx("rounded-control px-3 py-2 text-sm", left < 0 ? "bg-bad-bg text-bad" : "bg-brand-50 text-brand-700")}>Belum dialokasikan: <b className="num">{rp(left)}</b></div>
          </>}
          {step === 3 && <>
            <h2 className="font-semibold">Ringkasan</h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between py-2"><dt className="text-ink-2">Warung</dt><dd className="font-medium">{name}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-ink-2">Saldo awal kas</dt><dd className="num font-medium">{rp(cash || 0)}</dd></div>
              {WALLET_KINDS.map((k) => <div key={k} className="flex justify-between py-2"><dt className="text-ink-2">Dompet {WALLET_UI[k].label}</dt><dd className="num font-medium">{rp(alloc[k] || 0)}</dd></div>)}
            </dl>
            <p className="text-sm text-ink-2">Produk dan supplier bisa ditambahkan setelah masuk dashboard.</p>
          </>}
          {err && <p role="alert" className="rounded-control bg-bad-bg px-3 py-2 text-sm text-bad">{err}</p>}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={step === 0}>Kembali</Button>
            <div className="flex gap-2">
              {step === 2 && <Button variant="ghost" onClick={() => { setAlloc({ capital: 0, operations: 0, owner: 0, growth: 0 }); setStep(3); }}>Lewati</Button>}
              {step < 3 ? <Button onClick={next}>Lanjutkan</Button> : <Button loading={busy} onClick={finish}>Masuk ke dashboard</Button>}
            </div>
          </div>
        </Card>
      </main>
    </ToastProvider>
  );
}
