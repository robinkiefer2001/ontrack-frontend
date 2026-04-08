import type { HourlyRate } from "$lib/domain/project/types";

export const DEFAULT_HOURLY_RATES: HourlyRate[] = [
  {
    rateID: 1,
    rateType: "SystemEngineer",
    hourlyRate: 140,
    isDefault: true,
  },
  {
    rateID: 2,
    rateType: "ProjectManager",
    hourlyRate: 150,
    isDefault: false,
  },
  {
    rateID: 3,
    rateType: "Developer",
    hourlyRate: 120,
    isDefault: false,
  },
  {
    rateID: 4,
    rateType: "QA",
    hourlyRate: 100,
    isDefault: false,
  },
  {
    rateID: 5,
    rateType: "BusinessAnalyst",
    hourlyRate: 130,
    isDefault: false,
  },
];

export function getDefaultHourlyRate(): HourlyRate {
  return (
    DEFAULT_HOURLY_RATES.find((rate) => rate.isDefault) || DEFAULT_HOURLY_RATES[0]
  );
}

export function getHourlyRate(
  rateType: string,
  rates: HourlyRate[] = DEFAULT_HOURLY_RATES,
): number {
  const rate = rates.find((r) => r.rateType === rateType);
  return rate ? rate.hourlyRate : getDefaultHourlyRate().hourlyRate;
}

export function loadHourlyRates(): HourlyRate[] {
  if (typeof window === "undefined") return DEFAULT_HOURLY_RATES;

  const stored = localStorage.getItem("hourlyRates");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_HOURLY_RATES;
    }
  }
  return DEFAULT_HOURLY_RATES;
}

export function saveHourlyRates(rates: HourlyRate[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("hourlyRates", JSON.stringify(rates));
}
