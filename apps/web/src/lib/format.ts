/** Coerce API decimals (Prisma serializes Decimal columns as strings). */
export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
}

export function formatMoney(value: number | string, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(toNumber(value));
}

export function formatPct(value: number | string): string {
  const n = toNumber(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function formatNumber(value: number | string, maxFractionDigits = 8): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  }).format(toNumber(value));
}
