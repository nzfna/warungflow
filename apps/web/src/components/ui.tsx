"use client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2, X } from "lucide-react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link"; loading?: boolean; size?: "md" | "sm";
};
export function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
    secondary: "bg-white text-ink border border-line hover:bg-muted disabled:text-ink-3",
    ghost: "text-ink-2 hover:bg-muted",
    danger: "bg-bad text-white hover:bg-red-800 disabled:opacity-50",
    link: "text-brand-700 hover:underline px-0",
  }[variant];
  return (
    <button {...p} disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-[44px] px-4 text-sm" : "min-h-[36px] px-3 text-sm", v, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- Form ---------- */
export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}{required && <span className="text-bad" aria-label="wajib"> *</span>}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-2">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
const inputCls = "min-h-[44px] w-full rounded-control border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand-600 disabled:bg-muted";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, "py-2", p.className)} />;

export function MoneyInput({ value, onChange, ...p }: { value: number | ""; onChange: (n: number | "") => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-2">Rp</span>
      <input {...p} inputMode="numeric" className={cx(inputCls, "num pl-9 text-right")}
        value={value === "" ? "" : Number(value).toLocaleString("id-ID")}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); onChange(d === "" ? "" : Number(d)); }} />
    </div>
  );
}
export function NumberInput({ value, onChange, ...p }: { value: number | ""; onChange: (n: number | "") => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input {...p} type="number" inputMode="decimal" min={0} step="any" className={cx(inputCls, "num")} value={value}
    onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[21px] font-bold text-ink md:text-[26px]">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-ink-2">{desc}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
export const Card = ({ children, className }: { children: ReactNode; className?: string }) =>
  <section className={cx("rounded-card border border-line bg-white p-5", className)}>{children}</section>;

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className={cx("num mt-1 text-[22px] font-bold md:text-[26px]", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */
const BADGE: Record<string, [string, string]> = {
  lunas: ["Lunas", "ok"], belum_lunas: ["Belum lunas", "warn"], jatuh_tempo: ["Jatuh tempo", "bad"],
  aman: ["Stok aman", "ok"], menipis: ["Stok menipis", "warn"], habis: ["Habis", "bad"],
  completed: ["Selesai", "ok"], voided: ["Dibatalkan", "bad"], internal: ["Internal", "info"], external: ["Pelanggan", "info"],
  arsip: ["Diarsipkan", "muted"],
};
export function Badge({ kind, label }: { kind: string; label?: string }) {
  const [text, tone] = BADGE[kind] ?? [label ?? kind, "muted"];
  const t = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", bad: "bg-bad-bg text-bad", info: "bg-info-bg text-info", muted: "bg-muted text-ink-2" }[tone];
  const Icon = tone === "ok" ? CheckCircle2 : tone === "bad" || tone === "warn" ? AlertCircle : null;
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", t)}>{Icon && <Icon className="h-3 w-3" aria-hidden />}{label ?? text}</span>;
}

/* ---------- States ---------- */
export const Loading = ({ text = "Memuat data..." }: { text?: string }) =>
  <div className="flex items-center justify-center gap-2 py-12 text-ink-2" role="status"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>;
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="rounded-card border border-bad/30 bg-bad-bg p-4 text-sm text-bad" role="alert">
    <p>{message}</p>{onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Coba lagi</Button>}
  </div>
);
export const Empty = ({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
    <Inbox className="h-8 w-8 text-ink-3" aria-hidden />
    <p className="font-semibold text-ink">{title}</p>
    {desc && <p className="max-w-sm text-sm text-ink-2">{desc}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ---------- Table (desktop) / list (mobile) ---------- */
export type Col<T> = { h: string; cell: (r: T) => ReactNode; right?: boolean; m?: "title" | "sub" | "right" | "hide" };
export function Table<T>({ cols, rows, empty, onRow }: { cols: Col<T>[]; rows: T[]; empty: ReactNode; onRow?: (r: T) => void }) {
  if (!rows.length) return <div className="rounded-card border border-line bg-white">{empty}</div>;
  const title = cols.find((c) => c.m === "title") ?? cols[0];
  const sub = cols.filter((c) => c.m === "sub");
  const right = cols.filter((c) => c.m === "right");
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-white md:block">
        <table className="w-full text-[13px]">
          <thead className="border-b border-line bg-muted/60 text-left text-xs font-semibold text-ink-2">
            <tr>{cols.map((c) => <th key={c.h} scope="col" className={cx("px-4 py-3", c.right && "text-right")}>{c.h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className={cx(onRow && "cursor-pointer hover:bg-brand-50/50")} onClick={() => onRow?.(r)}>
                {cols.map((c) => <td key={c.h} className={cx("px-4 py-3 align-middle", c.right && "num text-right")}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line rounded-card border border-line bg-white md:hidden">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3" onClick={() => onRow?.(r)}>
            <div className="min-w-0">
              <div className="truncate font-medium">{title.cell(r)}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-2">{sub.map((c) => <span key={c.h}>{c.cell(r)}</span>)}</div>
            </div>
            <div className="num shrink-0 space-y-1 text-right font-semibold">{right.map((c) => <div key={c.h}>{c.cell(r)}</div>)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Modal / bottom sheet ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx("flex max-h-[92vh] w-full flex-col rounded-t-dialog bg-white shadow-xl md:rounded-dialog", wide ? "md:max-w-3xl" : "md:max-w-lg")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-control p-2 text-ink-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, title, children, confirmLabel, danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4 text-sm text-ink-2">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------- Toast ---------- */
type Toast = { id: number; text: string; kind: "ok" | "err" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex max-w-md items-center gap-2 rounded-control px-4 py-3 text-sm font-medium text-white shadow-lg", t.kind === "ok" ? "bg-ok" : "bg-bad")}>
            {t.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold", value === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-ink-2 hover:text-ink")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
