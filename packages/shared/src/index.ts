import { z } from "zod";

export const ROLES = ["owner", "admin", "kasir"] as const;
export type Role = (typeof ROLES)[number];

export const WALLET_KINDS = ["capital", "operations", "owner", "growth"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

export const WALLET_META: Record<WalletKind, { label: string; purpose: string }> = {
  capital: { label: "Modal", purpose: "Dana untuk belanja stok dan bayar supplier" },
  operations: { label: "Operasional", purpose: "Listrik, kresek, bensin, dan biaya rutin" },
  owner: { label: "Gaji Owner", purpose: "Gaji dan penarikan pemilik, terpisah dari biaya usaha" },
  growth: { label: "Tumbuh", purpose: "Dana darurat dan pengembangan warung" },
};

export const EXPENSE_CATEGORIES = [
  "Listrik", "Kresek & kemasan", "Kebersihan", "Transportasi", "Komunikasi", "Perbaikan", "Lainnya",
] as const;

export const PAYMENT_METHODS = ["cash", "transfer", "qris"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };

export const STOCK_ADJUST_TYPES = ["opname", "damaged", "expired", "lost"] as const;
export const STOCK_ADJUST_LABEL: Record<(typeof STOCK_ADJUST_TYPES)[number], string> = {
  opname: "Stok opname", damaged: "Rusak", expired: "Kedaluwarsa", lost: "Hilang",
};

const money = z.number().finite().min(0).max(1_000_000_000_000);
const posMoney = money.positive("Nominal harus lebih dari 0");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(80),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(1, "Isi password"),
});
export const setupBusinessSchema = z.object({
  name: z.string().trim().min(2, "Nama warung minimal 2 huruf").max(80),
  address: z.string().trim().max(200).optional().default(""),
  openingCash: money.default(0),
  initialAllocation: z.object({
    capital: money.default(0), operations: money.default(0), owner: money.default(0), growth: money.default(0),
  }).default({ capital: 0, operations: 0, owner: 0, growth: 0 }),
});
export const businessUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(200).optional(),
  allowNegativeStock: z.boolean().optional(),
  opsBudget: money.optional(),
});
export const categorySchema = z.object({ name: z.string().trim().min(1, "Isi nama kategori").max(40) });
export const productSchema = z.object({
  name: z.string().trim().min(1, "Isi nama produk").max(100),
  sku: z.string().trim().max(40).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  costPrice: money,
  sellPrice: money,
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  supplierId: z.string().uuid().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});
export const stockAdjustSchema = z.object({
  type: z.enum(STOCK_ADJUST_TYPES),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  newStock: z.number().min(0).optional(),
  reason: z.string().trim().min(3, "Isi alasan penyesuaian").max(200),
});
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Isi nama supplier").max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});
export const purchaseSchema = z.object({
  supplierId: z.string().uuid("Pilih supplier"),
  items: z.array(z.object({
    productId: z.string().uuid(), quantity: z.number().positive(), unitCost: money,
  })).min(1, "Tambahkan minimal 1 produk").max(200, "Maksimal 200 baris per pembelian"),
  discount: money.default(0),
  extraCost: money.default(0),
  paidAmount: money.default(0),
  paymentMethod: z.enum(["cash", "transfer"]).default("cash"),
  dueDate: z.string().optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});
export const supplierPaymentSchema = z.object({
  amount: posMoney, method: z.enum(["cash", "transfer"]).default("cash"), note: z.string().trim().max(200).optional().nullable(),
});
export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() })).min(1, "Keranjang masih kosong").max(200, "Maksimal 200 item per transaksi"),
  discount: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  received: money.optional(),
  kind: z.enum(["external", "internal"]).default("external"),
  payFrom: z.enum(["cash", "owner_wallet"]).default("cash"),
});
export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pilih kategori").max(60),
  amount: posMoney,
  spentOn: z.string().min(8, "Isi tanggal"),
  walletKind: z.enum(WALLET_KINDS).default("operations"),
  method: z.enum(["cash", "transfer"]).default("cash"),
  note: z.string().trim().max(300).optional().nullable(),
});
export const allocationSchema = z.object({
  basis: z.string().trim().min(2, "Isi dasar alokasi").max(100),
  amounts: z.object({ capital: money.default(0), operations: money.default(0), owner: money.default(0), growth: money.default(0) }),
  note: z.string().trim().max(300).optional().nullable(),
});
export const transferSchema = z.object({
  from: z.enum(WALLET_KINDS), to: z.enum(WALLET_KINDS), amount: posMoney, note: z.string().trim().max(200).optional().nullable(),
});
export const payoutSchema = z.object({
  kind: z.enum(["salary", "withdrawal"]), amount: posMoney, method: z.enum(["cash", "transfer"]).default("cash"), note: z.string().trim().max(200).optional().nullable(),
});
export const goalSchema = z.object({
  name: z.string().trim().min(2, "Isi nama tujuan").max(80),
  targetAmount: posMoney,
  deadline: z.string().optional().nullable(),
  kind: z.enum(["emergency", "growth"]).default("growth"),
});
export const goalUseSchema = z.object({ amount: posMoney, note: z.string().trim().min(3, "Isi catatan penggunaan").max(200) });
export const goalFundSchema = z.object({ amount: posMoney });
export const closingSchema = z.object({
  date: z.string().min(8), actualCash: money, note: z.string().trim().max(300).optional().nullable(),
});
export const userInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "kasir"]),
});

export const rupiah = (n: number) =>
  "Rp" + Math.round(n).toLocaleString("id-ID");
