export function num(n: number): string {
  return n.toLocaleString("en-US");
}

export function pct(n: number | null): string {
  return n == null ? "–" : `${n}%`;
}

export function money(cents: number | null): string {
  if (cents == null) return "–";
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars >= 1000 || Number.isInteger(dollars) ? 0 : 2,
  });
}

export function seconds(n: number | null): string {
  if (n == null) return "–";
  if (n < 60) return `${n}s`;
  return `${Math.round((n / 60) * 10) / 10}m`;
}

export function shortDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
