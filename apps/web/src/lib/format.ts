export const rp = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return (v < 0 ? "-" : "") + "Rp" + Math.abs(Math.round(v)).toLocaleString("id-ID");
};
export const qty = (n: number | string) => Number(n).toLocaleString("id-ID", { maximumFractionDigits: 3 });
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const tgl = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const s = typeof d === "string" ? d : d.toISOString();
  const dt = new Date(s.length === 10 ? s + "T00:00:00+07:00" : s);
  const j = new Date(dt.getTime() + (dt.getTimezoneOffset() + 420) * 60000);
  return `${j.getDate()} ${BULAN[j.getMonth()]} ${j.getFullYear()}`;
};
export const jam = (d: string) =>
  new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":");
export const todayJkt = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
export const monthStartJkt = () => todayJkt().slice(0, 8) + "01";
export const addDays = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
