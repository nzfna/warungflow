"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  BarChart3, Boxes, ClipboardCheck, Home, LayoutGrid, LogOut, Menu as MenuIcon, PiggyBank, Receipt, Settings, ShoppingBasket,
  ShoppingCart, Sprout, Store, Truck, Users, Wallet, Wallet2, Package, Banknote,
} from "lucide-react";
import { api } from "@/lib/api";
import { Loading, ToastProvider, cx } from "./ui";
import type { Role } from "@warungflow/shared";

type Me = { user: { id: string; name: string; email: string }; business: { id: string; name: string } | null; role: Role | null };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;

type Item = { href: string; label: string; icon: any; roles?: Role[] };
const NAV: { group: string; items: Item[] }[] = [
  { group: "Ringkasan", items: [{ href: "/dashboard", label: "Dashboard", icon: Home }] },
  { group: "Transaksi", items: [
    { href: "/kasir", label: "Kasir", icon: ShoppingCart },
    { href: "/penjualan", label: "Penjualan", icon: Receipt },
    { href: "/belanja-internal", label: "Belanja Internal", icon: ShoppingBasket, roles: ["owner"] },
  ] },
  { group: "Inventaris", items: [
    { href: "/produk", label: "Produk & Stok", icon: Boxes },
    { href: "/pembelian", label: "Pembelian", icon: Package, roles: ["owner", "admin"] },
    { href: "/supplier", label: "Supplier", icon: Truck, roles: ["owner", "admin"] },
  ] },
  { group: "Keuangan", items: [
    { href: "/dompet", label: "4 Dompet", icon: Wallet2, roles: ["owner", "admin"] },
    { href: "/pengeluaran", label: "Pengeluaran", icon: Banknote, roles: ["owner", "admin"] },
    { href: "/alokasi", label: "Alokasi Dana", icon: PiggyBank, roles: ["owner"] },
    { href: "/gaji", label: "Gaji Owner", icon: Wallet, roles: ["owner"] },
    { href: "/tumbuh", label: "Dana Tumbuh", icon: Sprout, roles: ["owner", "admin"] },
  ] },
  { group: "Laporan", items: [
    { href: "/laporan", label: "Laporan Keuangan", icon: BarChart3, roles: ["owner", "admin"] },
    { href: "/tutup-buku", label: "Tutup Buku", icon: ClipboardCheck },
  ] },
  { group: "Pengaturan", items: [
    { href: "/pengaturan", label: "Pengaturan Warung", icon: Settings, roles: ["owner"] },
    { href: "/pengguna", label: "Pengguna", icon: Users, roles: ["owner"] },
  ] },
];

const BOTTOM: Item[] = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/kasir", label: "Kasir", icon: ShoppingCart },
  { href: "/produk", label: "Stok", icon: Boxes },
  { href: "/laporan", label: "Laporan", icon: BarChart3, roles: ["owner", "admin"] },
  { href: "/menu", label: "Menu", icon: MenuIcon },
];

export function visibleNav(role: Role) {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((g) => g.items.length);
}

export function Shell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<Me>("/auth/me").then((m) => (m.business ? setMe(m) : router.replace("/mulai"))).catch(() => router.replace("/masuk"));
  }, [router]);

  if (!me) return <div className="min-h-screen"><Loading text="Membuka WarungFlow..." /></div>;
  const role = me.role!;
  const logout = async () => { await api("/auth/logout", { method: "POST", body: {} }); window.location.href = "/masuk"; };
  const active = (h: string) => path === h || path.startsWith(h + "/");

  return (
    <MeCtx.Provider value={me}>
      <ToastProvider>
        {/* Sidebar desktop / rail tablet */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-line bg-white md:flex lg:w-sidebar">
          <div className="flex h-header items-center gap-2 border-b border-line px-4">
            <Store className="h-6 w-6 shrink-0 text-brand-600" aria-hidden />
            <span className="hidden text-lg font-bold text-brand-900 lg:block">WarungFlow</span>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navigasi utama">
            {visibleNav(role).map((g) => (
              <div key={g.group} className="mb-3">
                <div className="hidden px-3 pb-1 text-xs font-semibold text-ink-3 lg:block">{g.group}</div>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} title={i.label} aria-current={active(i.href) ? "page" : undefined}
                    className={cx("relative mb-0.5 flex min-h-[40px] items-center gap-3 rounded-control px-3 text-sm font-medium",
                      active(i.href) ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-muted hover:text-ink")}>
                    {active(i.href) && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-600" />}
                    <i.icon className="h-[18px] w-[18px] shrink-0" aria-hidden /><span className="hidden lg:block">{i.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="md:pl-16 lg:pl-sidebar">
          <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-line bg-white px-4 md:h-header md:px-8">
            <div className="flex items-center gap-2 md:hidden"><Store className="h-5 w-5 text-brand-600" /><span className="font-bold text-brand-900">{me.business!.name}</span></div>
            <div className="hidden md:block"><div className="font-semibold">{me.business!.name}</div></div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right text-xs leading-tight sm:block"><div className="font-semibold">{me.user.name}</div><div className="capitalize text-ink-2">{role}</div></div>
              <button onClick={logout} aria-label="Keluar" title="Keluar" className="rounded-control p-2 text-ink-2 hover:bg-muted"><LogOut className="h-5 w-5" /></button>
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 md:px-8 md:pb-10">{children}</main>
        </div>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-line bg-white md:hidden" aria-label="Navigasi bawah">
          {BOTTOM.filter((i) => !i.roles || i.roles.includes(role)).map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
              className={cx("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active(i.href) ? "text-brand-700" : "text-ink-2")}>
              <i.icon className="h-5 w-5" aria-hidden />{i.label}
            </Link>
          ))}
        </nav>
      </ToastProvider>
    </MeCtx.Provider>
  );
}

export { LayoutGrid };
