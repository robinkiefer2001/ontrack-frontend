export function formatBudget(value: number | null): string {
  if (value == null) return "-";
  const formatted = new Intl.NumberFormat("de-CH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} CHF`;
}

export function dueDateLabel(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("de-CH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatHours(totalHours: number): string {
  return `${totalHours.toLocaleString("de-CH")} h`;
}
