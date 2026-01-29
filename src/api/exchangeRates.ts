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
 * Fetches exchange rates from the Frankfurter API.
 * Uses the European Central Bank rates.
 * 
 * @param baseCurrency - The base currency to convert from
 * @param date - Optional date for historical rates (YYYY-MM-DD format)
 */
async function fetchRate(baseCurrency: string, date?: string): Promise<number> {
  const targetCurrency = getTargetCurrency();
  
  // Same currency is always 1:1
  if (baseCurrency === targetCurrency) {
    return 1;
  }
  
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
      console.warn(`Warning: Could not fetch rate for ${currency}, using 1:1`);
      return { currency, rate: 1 };
    }
  });
  
  const results = await Promise.all(ratePromises);
  
  for (const { currency, rate } of results) {
    rates.set(currency, rate);
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
      const rate = exchangeRates.get(currency) || 1;
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
