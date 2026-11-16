import Link from "next/link";
import { Store } from "lucide-react";
export function AuthFrame({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-6 flex items-center gap-2 text-xl font-bold text-brand-900"><Store className="h-6 w-6 text-brand-600" />WarungFlow</Link>
        <div className="rounded-card border border-line bg-white p-6">
          <h1 className="mb-5 text-[22px] font-bold">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-ink-2">{footer}</p>
      </div>
    </main>
  );
}
