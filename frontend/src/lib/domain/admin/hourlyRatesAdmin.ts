import type { HourlyRate } from "$lib/domain/project/types";

export function addHourlyRate(
  rates: HourlyRate[],
  newRateType: string,
  newRateAmount: number,
): HourlyRate[] {
  if (!newRateType.trim() || newRateAmount <= 0) return rates;

  const newRate: HourlyRate = {
    rateID: Math.max(...rates.map((r) => r.rateID), 0) + 1,
    rateType: newRateType.trim(),
    hourlyRate: newRateAmount,
    isDefault: false,
  };

  return [...rates, newRate];
}

export function deleteHourlyRate(rates: HourlyRate[], rateID: number): HourlyRate[] {
  if (rates.length <= 1) return rates;
  return rates.filter((r) => r.rateID !== rateID);
}

export function setDefaultHourlyRate(rates: HourlyRate[], rateID: number): HourlyRate[] {
  return rates.map((r) => ({
    ...r,
    isDefault: r.rateID === rateID,
  }));
}
