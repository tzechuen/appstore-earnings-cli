import type { AppEarnings, ExchangeRatesResponse } from "../types.js";
import { loadConfig } from "../config/loader.js";

const FRANKFURTER_API_URL = "https://api.frankfurter.app";

/**
 * Gets the target currency from config, defaulting to USD.
 */
export function getTargetCurrency(): string {
  const config = loadConfig();
  return config.targetCurrency;
}

/**
 * Fallback source covering currencies the ECB doesn't publish (e.g. TWD, AED, SAR, VND).
 * https://github.com/fawazahmed0/exchange-api
 */
const FALLBACK_API_URLS = [
  (date: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies`,
  (date: string) => `https://${date}.currency-api.pages.dev/v1/currencies`,
];

/**
 * Fetches a rate from the Frankfurter API (European Central Bank rates).
 *
 * @param baseCurrency - The base currency to convert from
 * @param date - Optional date for historical rates (YYYY-MM-DD format)
 */
async function fetchFrankfurterRate(baseCurrency: string, targetCurrency: string, date?: string): Promise<number> {
  const endpoint = date ? `/${date}` : "/latest";
  const url = `${FRANKFURTER_API_URL}${endpoint}?from=${baseCurrency}&to=${targetCurrency}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rate for ${baseCurrency}: ${response.statusText}`);
  }

  const data: ExchangeRatesResponse = await response.json();

  const rate = data.rates[targetCurrency];
  if (!rate) {
    throw new Error(`No exchange rate found for ${baseCurrency} to ${targetCurrency}`);
  }

  return rate;
}

/**
 * Fetches a rate from the fallback currency API, trying each mirror in turn.
 */
async function fetchFallbackRate(baseCurrency: string, targetCurrency: string, date?: string): Promise<number> {
  const base = baseCurrency.toLowerCase();
  const target = targetCurrency.toLowerCase();
  let lastError: unknown;

  for (const buildUrl of FALLBACK_API_URLS) {
    try {
      const response = await fetch(`${buildUrl(date || "latest")}/${base}.json`);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = (await response.json()) as Record<string, Record<string, number>>;
      const rate = data[base]?.[target];
      if (typeof rate === "number" && rate > 0) {
        return rate;
      }
      throw new Error(`No exchange rate found for ${baseCurrency} to ${targetCurrency}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Fetches an exchange rate, using ECB rates via Frankfurter when available and
 * falling back to a broader source for currencies the ECB doesn't cover.
 */
async function fetchRate(baseCurrency: string, date?: string): Promise<number> {
  const targetCurrency = getTargetCurrency();

  // Same currency is always 1:1
  if (baseCurrency === targetCurrency) {
    return 1;
  }

  try {
    return await fetchFrankfurterRate(baseCurrency, targetCurrency, date);
  } catch {
    return await fetchFallbackRate(baseCurrency, targetCurrency, date);
  }
}

/**
 * Fetches exchange rates for multiple currencies in a single request.
 * Frankfurter API supports multiple target currencies, but we need multiple base currencies,
 * so we make parallel requests.
 */
export async function fetchExchangeRates(
  currencies: string[],
  date?: string
): Promise<Map<string, number>> {
  const targetCurrency = getTargetCurrency();
  const rates = new Map<string, number>();
  
  // Filter out target currency since it's always 1:1
  const currenciesToFetch = currencies.filter(c => c !== targetCurrency);
  
  // Add target currency rate
  rates.set(targetCurrency, 1);
  
  if (currenciesToFetch.length === 0) {
    return rates;
  }
  
  // Fetch rates in parallel
  const ratePromises = currenciesToFetch.map(async (currency) => {
    try {
      const rate = await fetchRate(currency, date);
      return { currency, rate };
    } catch (error) {
      return { currency, rate: null };
    }
  });
  
  const results = await Promise.all(ratePromises);
  const missing: string[] = [];
  
  for (const { currency, rate } of results) {
    if (rate === null) {
      missing.push(currency);
    } else {
      rates.set(currency, rate);
    }
  }
  
  if (missing.length > 0) {
    // Never assume 1:1 — that silently inflates totals (e.g. 47 TWD shown as 47 SGD).
    console.warn(
      `Warning: Could not fetch rates for ${missing.join(", ")}. ` +
      `Proceeds in ${missing.length === 1 ? "this currency" : "these currencies"} are EXCLUDED from totals.`
    );
  }
  
  return rates;
}

/**
 * Converts all proceeds in AppEarnings to target currency using the provided exchange rates.
 */
export function convertToTargetCurrency(
  earnings: AppEarnings[],
  exchangeRates: Map<string, number>
): AppEarnings[] {
  return earnings.map((app) => {
    let total = 0;
    
    for (const [currency, amount] of Object.entries(app.proceedsByCurrency)) {
      const rate = exchangeRates.get(currency);
      if (rate === undefined) continue;
      total += amount * rate;
    }
    
    return {
      ...app,
      totalProceeds: total,
    };
  });
}

/**
 * Formats a number as currency using the target currency.
 */
export function formatCurrency(amount: number): string {
  const targetCurrency = getTargetCurrency();
  
  // Determine locale based on currency
  const localeMap: Record<string, string> = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    SGD: "en-SG",
    JPY: "ja-JP",
    AUD: "en-AU",
    CAD: "en-CA",
    CHF: "de-CH",
    CNY: "zh-CN",
    HKD: "zh-HK",
    NZD: "en-NZ",
    SEK: "sv-SE",
    KRW: "ko-KR",
    MXN: "es-MX",
    INR: "en-IN",
    BRL: "pt-BR",
  };
  
  const locale = localeMap[targetCurrency] || "en-US";
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: targetCurrency,
  }).format(amount);
}
