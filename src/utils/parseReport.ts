import type { SalesReportRow, AppEarnings } from "../types.js";

/**
 * Column indices for the Summary Sales Report TSV.
 * These are based on Apple's documentation for the Summary Sales Report format.
 */
const COLUMNS = {
  PROVIDER: 0,
  PROVIDER_COUNTRY: 1,
  SKU: 2,
  DEVELOPER: 3,
  TITLE: 4,
  VERSION: 5,
  PRODUCT_TYPE_IDENTIFIER: 6,
  UNITS: 7,
  DEVELOPER_PROCEEDS: 8,
  BEGIN_DATE: 9,
  END_DATE: 10,
  CUSTOMER_CURRENCY: 11,
  COUNTRY_CODE: 12,
  CURRENCY_OF_PROCEEDS: 13,
  APPLE_IDENTIFIER: 14,
  CUSTOMER_PRICE: 15,
  PROMO_CODE: 16,
  PARENT_IDENTIFIER: 17,
  SUBSCRIPTION: 18,
  PERIOD: 19,
  CATEGORY: 20,
  CMB: 21,
  DEVICE: 22,
  SUPPORTED_PLATFORMS: 23,
  PROCEEDS_REASON: 24,
  PRESERVED_PRICING: 25,
  CLIENT: 26,
  ORDER_TYPE: 27,
};

/**
 * Parses a single row from the TSV report.
 */
function parseRow(columns: string[]): SalesReportRow | null {
  // Skip rows that don't have enough columns
  if (columns.length < 15) {
    return null;
  }
  
  const units = parseFloat(columns[COLUMNS.UNITS]) || 0;
  const developerProceeds = parseFloat(columns[COLUMNS.DEVELOPER_PROCEEDS]) || 0;
  const customerPrice = parseFloat(columns[COLUMNS.CUSTOMER_PRICE]) || 0;
  
  return {
    provider: columns[COLUMNS.PROVIDER] || "",
    providerCountry: columns[COLUMNS.PROVIDER_COUNTRY] || "",
    sku: columns[COLUMNS.SKU] || "",
    developer: columns[COLUMNS.DEVELOPER] || "",
    title: columns[COLUMNS.TITLE] || "",
    version: columns[COLUMNS.VERSION] || "",
    productTypeIdentifier: columns[COLUMNS.PRODUCT_TYPE_IDENTIFIER] || "",
    units,
    developerProceeds,
    beginDate: columns[COLUMNS.BEGIN_DATE] || "",
    endDate: columns[COLUMNS.END_DATE] || "",
    customerCurrency: columns[COLUMNS.CUSTOMER_CURRENCY] || "",
    countryCode: columns[COLUMNS.COUNTRY_CODE] || "",
    currencyOfProceeds: columns[COLUMNS.CURRENCY_OF_PROCEEDS] || "",
    appleIdentifier: columns[COLUMNS.APPLE_IDENTIFIER] || "",
    customerPrice,
    promoCode: columns[COLUMNS.PROMO_CODE] || "",
    parentIdentifier: columns[COLUMNS.PARENT_IDENTIFIER] || "",
    subscription: columns[COLUMNS.SUBSCRIPTION] || "",
    period: columns[COLUMNS.PERIOD] || "",
    category: columns[COLUMNS.CATEGORY] || "",
    cmb: columns[COLUMNS.CMB] || "",
    device: columns[COLUMNS.DEVICE] || "",
    supportedPlatforms: columns[COLUMNS.SUPPORTED_PLATFORMS] || "",
    proceedsReason: columns[COLUMNS.PROCEEDS_REASON] || "",
    preservedPricing: columns[COLUMNS.PRESERVED_PRICING] || "",
    client: columns[COLUMNS.CLIENT] || "",
    orderType: columns[COLUMNS.ORDER_TYPE] || "",
  };
}

/**
 * Parses the TSV report content into an array of SalesReportRow objects.
 */
export function parseReport(tsvContent: string): SalesReportRow[] {
  const lines = tsvContent.trim().split("\n");
  
  // Skip header row
  if (lines.length <= 1) {
    return [];
  }
  
  const rows: SalesReportRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const columns = line.split("\t");
    const row = parseRow(columns);
    
    if (row) {
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Aggregates sales report rows by app, calculating total proceeds per currency.
 * Returns earnings grouped by Apple Identifier (app ID).
 */
export function aggregateByApp(rows: SalesReportRow[]): AppEarnings[] {
  const appMap = new Map<string, AppEarnings>();
  
  for (const row of rows) {
    // Skip rows with no proceeds
    if (row.developerProceeds === 0) continue;
    
    // Use Apple Identifier as the unique key, fallback to SKU
    const appId = row.appleIdentifier || row.sku;
    if (!appId) continue;
    
    let app = appMap.get(appId);
    
    if (!app) {
      app = {
        appleIdentifier: row.appleIdentifier,
        title: row.title,
        sku: row.sku,
        proceedsByCurrency: {},
        totalProceeds: 0,
      };
      appMap.set(appId, app);
    }
    
    // Aggregate proceeds by currency
    const currency = row.currencyOfProceeds || "USD";
    const currentProceeds = app.proceedsByCurrency[currency] || 0;
    
    // Calculate total proceeds for this row (units * proceeds per unit)
    // Note: developerProceeds is already the per-unit amount
    const totalProceeds = row.units * row.developerProceeds;
    
    app.proceedsByCurrency[currency] = currentProceeds + totalProceeds;
  }
  
  return Array.from(appMap.values());
}

/**
 * Gets all unique currencies from the aggregated earnings.
 */
export function getUniqueCurrencies(earnings: AppEarnings[]): string[] {
  const currencies = new Set<string>();
  
  for (const app of earnings) {
    for (const currency of Object.keys(app.proceedsByCurrency)) {
      currencies.add(currency);
    }
  }
  
  return Array.from(currencies);
}
