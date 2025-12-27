import type { AppEarnings, ExchangeRatesResponse } from "../types.js";

const FRANKFURTER_API_URL = "https://api.frankfurter.app";
const TARGET_CURRENCY = "SGD";

/**
 * Fetches exchange rates from the Frankfurter API.
 * Uses the European Central Bank rates.
 * 
 * @param baseCurrency - The base currency to convert from
 * @param date - Optional date for historical rates (YYYY-MM-DD format)
 */
async function fetchRate(baseCurrency: string, date?: string): Promise<number> {
  // SGD to SGD is always 1
  if (baseCurrency === TARGET_CURRENCY) {
    return 1;
  }
  
  const endpoint = date ? `/${date}` : "/latest";
  const url = `${FRANKFURTER_API_URL}${endpoint}?from=${baseCurrency}&to=${TARGET_CURRENCY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rate for ${baseCurrency}: ${response.statusText}`);
  }
  
  const data: ExchangeRatesResponse = await response.json();
  
  const rate = data.rates[TARGET_CURRENCY];
  if (!rate) {
    throw new Error(`No exchange rate found for ${baseCurrency} to ${TARGET_CURRENCY}`);
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
  const rates = new Map<string, number>();
  
  // Filter out SGD since it's always 1:1
  const currenciesToFetch = currencies.filter(c => c !== TARGET_CURRENCY);
  
  // Add SGD rate
  rates.set(TARGET_CURRENCY, 1);
  
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
 * Converts all proceeds in AppEarnings to SGD using the provided exchange rates.
 */
export function convertToSGD(
  earnings: AppEarnings[],
  exchangeRates: Map<string, number>
): AppEarnings[] {
  return earnings.map((app) => {
    let totalSGD = 0;
    
    for (const [currency, amount] of Object.entries(app.proceedsByCurrency)) {
      const rate = exchangeRates.get(currency) || 1;
      totalSGD += amount * rate;
    }
    
    return {
      ...app,
      totalProceedsSGD: totalSGD,
    };
  });
}

/**
 * Formats a number as SGD currency.
 */
export function formatSGD(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amount);
}
