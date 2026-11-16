import Link from "next/link";
import { BarChart3, Boxes, Package, ShoppingCart, Store, Truck, Wallet2 } from "lucide-react";
import { WALLET_UI } from "@/lib/wallets";
import { WALLET_KINDS } from "@warungflow/shared";

const features = [
  { icon: ShoppingCart, t: "Kasir", d: "Catat penjualan, hitung kembalian, stok berkurang otomatis." },
  { icon: Boxes, t: "Stok", d: "Pantau barang yang menipis dan catat yang rusak atau kedaluwarsa." },
  { icon: Truck, t: "Supplier", d: "Catat pembelian, tempo, dan utang yang belum dibayar." },
  { icon: Wallet2, t: "Keuangan", d: "Pisahkan modal, biaya rutin, gaji owner, dan dana tumbuh." },
  { icon: BarChart3, t: "Laporan", d: "Bedakan penjualan, keuntungan, dan saldo kas dengan bahasa sehari-hari." },
];
const faqs = [
  ["Apakah WarungFlow bisa dipakai di HP?", "Bisa. Semua fitur utama berjalan di browser HP, tablet, dan komputer."],
  ["Apakah empat dompet itu rekening bank?", "Bukan. Dompet adalah cara membagi dan mencatat uang usaha. Saldonya bisa dicocokkan dengan kas dan rekening sebenarnya lewat tutup buku."],
  ["Berapa persen yang harus saya isi ke tiap dompet?", "Tidak ada angka baku. Kamu yang menentukan nominal dan dasar pembagiannya di menu Alokasi Dana."],
  ["Apakah pegawai bisa ikut mencatat?", "Bisa. Owner menambahkan akun admin atau kasir. Kasir hanya melihat menu yang dibutuhkan untuk berjualan."],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 text-lg font-bold text-brand-900"><Store className="h-6 w-6 text-brand-600" />WarungFlow</div>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <a href="#fitur" className="hidden px-3 py-2 text-ink-2 hover:text-ink sm:block">Fitur</a>
          <a href="#dompet" className="hidden px-3 py-2 text-ink-2 hover:text-ink sm:block">Empat dompet</a>
          <Link href="/masuk" className="rounded-control px-3 py-2 text-ink hover:bg-muted">Masuk</Link>
          <Link href="/daftar" className="rounded-control bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">Daftar</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 md:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:pt-16">
        <div>
          <h1 className="text-[32px] font-bold leading-tight text-brand-900 md:text-[44px]">Omzet besar belum tentu untung. Tahu ke mana uang warung pergi.</h1>
          <p className="mt-4 max-w-xl text-base text-ink-2">WarungFlow membantu pemilik warung sembako mencatat jualan dan stok, lalu memisahkan uang usaha dari uang pribadi ke empat dompet.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/daftar" className="inline-flex min-h-[48px] items-center rounded-control bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700">Daftar gratis</Link>
            <Link href="/masuk" className="inline-flex min-h-[48px] items-center rounded-control border border-line px-6 font-semibold hover:bg-muted">Masuk</Link>
          </div>
        </div>

        {/* Pratinjau dashboard (contoh data) */}
        <div className="rounded-card border border-line bg-page p-4" aria-label="Contoh tampilan dashboard">
          <div className="mb-3 flex items-center justify-between text-xs text-ink-2"><span className="font-semibold text-ink">Warung Bu Sari</span><span>Contoh data</span></div>
          <div className="grid grid-cols-3 gap-2">
            {[["Penjualan hari ini", "Rp1.842.000"], ["Keuntungan kotor", "Rp312.500"], ["Transaksi", "47"]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line bg-white p-3"><div className="text-[11px] text-ink-2">{l}</div><div className="num mt-1 text-sm font-bold md:text-base">{v}</div></div>
            ))}
          </div>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
            {([["capital", "Rp12.400.000"], ["operations", "Rp640.000"], ["owner", "Rp950.000"], ["growth", "Rp1.250.000"]] as const).map(([k, v]) => {
              const u = WALLET_UI[k]; const I = u.icon;
              return (
                <div key={k} className="flex items-center justify-between px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm"><span className={`rounded-md p-1.5 ${u.bg} ${u.text}`}><I className="h-4 w-4" /></span>Dompet {u.label}</span>
                  <span className="num text-sm font-semibold">{v}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg border border-warn/30 bg-warn-bg px-3 py-2 text-xs text-warn">Stok minyak goreng tinggal 4 pcs.</div>
        </div>
      </section>

      <section id="fitur" className="border-y border-line bg-page">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-bold text-brand-900">Yang dikerjakan setiap hari, dalam satu tempat</h2>
          <dl className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.t} className="flex gap-3 border-t border-line pt-4">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                <div><dt className="font-semibold">{f.t}</dt><dd className="text-sm text-ink-2">{f.d}</dd></div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="dompet" className="mx-auto max-w-6xl px-4 py-14 md:px-8">
        <h2 className="text-2xl font-bold text-brand-900">Empat dompet, satu aturan: uang punya tugasnya</h2>
        <p className="mt-2 max-w-2xl text-ink-2">Dompet adalah pembagian uang usaha. Besarnya kamu tentukan sendiri, bukan angka baku.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WALLET_KINDS.map((k) => {
            const u = WALLET_UI[k]; const I = u.icon;
            return (
              <div key={k} className={`rounded-card border-l-4 ${u.border} ${u.bg} p-4`}>
                <I className={`h-5 w-5 ${u.text}`} aria-hidden />
                <div className="mt-2 font-semibold">Dompet {u.label}</div>
                <p className="mt-1 text-sm text-ink-2">{u.purpose}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-page">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-bold text-brand-900">Cara mulai</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {[["Buat warung", "Isi nama warung dan saldo kas awal."], ["Masukkan barang", "Tambah produk, harga, dan stok."], ["Mulai berjualan", "Catat penjualan, lalu tutup buku di malam hari."]].map(([t, d], i) => (
              <li key={t} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span><div><div className="font-semibold">{t}</div><p className="text-sm text-ink-2">{d}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-8">
        <h2 className="text-2xl font-bold text-brand-900">Pertanyaan yang sering muncul</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-4"><summary className="cursor-pointer list-none font-semibold marker:content-none">{q}</summary><p className="mt-2 text-sm text-ink-2">{a}</p></details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-card bg-brand-900 p-6 text-white">
          <p className="max-w-md text-lg font-semibold">Warung yang sehat adalah warung yang tahu ke mana uangnya pergi.</p>
          <Link href="/daftar" className="inline-flex min-h-[48px] items-center rounded-control bg-white px-6 font-semibold text-brand-900 hover:bg-brand-50">Daftar sekarang</Link>
        </div>
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-ink-2">WarungFlow - catatan warung yang rapi</footer>
    </div>
  );
}
