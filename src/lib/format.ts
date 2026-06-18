export function formatCRC(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function daysBetween(from: string | Date, to: Date = new Date()): number {
  const f = typeof from === "string" ? new Date(from) : from;
  return Math.floor((to.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}

export function agingBucket(days: number): string {
  if (days <= 30) return "0-30 días";
  if (days <= 60) return "31-60 días";
  if (days <= 90) return "61-90 días";
  return "+90 días";
}
