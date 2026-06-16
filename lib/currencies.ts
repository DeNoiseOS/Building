/**
 * V0.11 — Supported currencies.
 *
 * The single source of truth for currency selection across the app.
 * A project picks one currency at creation; every financial module
 * (department budgets, budget requests, custodies, expenses) inherits
 * it. There is no per-record currency input anywhere else.
 */

export const SUPPORTED_CURRENCIES = [
  { value: "SAR", label: "SAR — Saudi Riyal", symbol: "SAR" },
  { value: "AED", label: "AED — UAE Dirham", symbol: "AED" },
  { value: "QAR", label: "QAR — Qatari Riyal", symbol: "QAR" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar", symbol: "KWD" },
  { value: "BHD", label: "BHD — Bahraini Dinar", symbol: "BHD" },
  { value: "OMR", label: "OMR — Omani Rial", symbol: "OMR" },
  { value: "USD", label: "USD — US Dollar", symbol: "USD" },
  { value: "EUR", label: "EUR — Euro", symbol: "EUR" },
  { value: "GBP", label: "GBP — British Pound", symbol: "GBP" },
  { value: "EGP", label: "EGP — Egyptian Pound", symbol: "EGP" },
  { value: "JOD", label: "JOD — Jordanian Dinar", symbol: "JOD" },
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number]["value"];

export const CURRENCY_VALUES = SUPPORTED_CURRENCIES.map((c) => c.value) as readonly Currency[];

export const DEFAULT_CURRENCY: Currency = "SAR";

export function isCurrency(value: string): value is Currency {
  return (CURRENCY_VALUES as readonly string[]).includes(value);
}

export function normalizeCurrency(value: string | null | undefined): Currency {
  if (value && isCurrency(value)) return value;
  return DEFAULT_CURRENCY;
}

/** Format an amount with a currency suffix, e.g. `1,200 SAR`. */
export function formatCurrencyAmount(
  amount: number,
  currency: string | null | undefined
): string {
  const c = normalizeCurrency(currency ?? undefined);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${c}`;
}
