export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Opts = { method?: string; body?: unknown; idem?: string };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const run = () =>
    fetch("/api" + path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(opts.idem ? { "Idempotency-Key": opts.idem } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  let res: Response;
  try {
    res = await run();
    if (res.status === 401 && !path.startsWith("/auth/")) {
      const rf = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (rf.ok) res = await run();
    }
  } catch {
    throw new ApiError(0, "Belum tersimpan. Periksa koneksi lalu coba lagi.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) window.location.href = "/masuk";
    throw new ApiError(res.status, data.error || "Terjadi kesalahan. Coba lagi.");
  }
  return data as T;
}
