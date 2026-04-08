export function parseSwissDate(value: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateOrNull(value: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso;
  return parseSwissDate(value as string);
}

export function toInputDate(value: Date | string | null): string | null {
  const date = toDateOrNull(value);
  return date ? date.toISOString().split("T")[0] : null;
}
