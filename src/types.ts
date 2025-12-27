// App Store Connect API configuration (Finance role - for reports)
export interface AppStoreConnectConfig {
  issuerId: string;
  keyId: string;
  privateKeyPath: string;
  vendorNumber: string;
}

// App Store Connect API configuration (App Manager role - for app/IAP data)
export interface AppManagerConfig {
  issuerId: string;
  keyId: string;
  privateKeyPath: string;
}

// Fiscal month representation (kept for reference)
export interface FiscalMonth {
  year: number; // Fiscal year (e.g., 2025)
  month: number; // Fiscal month (1-12)
  startDate: Date;
  endDate: Date;
  displayName: string; // e.g., "December 2024 (Nov 25 - Dec 29)"
  reportDate: string; // Format: YYYY-MM for API calls
}

// Calendar month representation
export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  displayName: string; // e.g., "August 2025"
  reportDate: string; // Format: YYYY-MM for API calls
}

// Raw sales report row from Apple's TSV (kept for reference)
export interface SalesReportRow {
  provider: string;
  providerCountry: string;
  sku: string;
  developer: string;
  title: string;
  version: string;
  productTypeIdentifier: string;
  units: number;
  developerProceeds: number;
  beginDate: string;
  endDate: string;
  customerCurrency: string;
  countryCode: string;
  currencyOfProceeds: string;
  appleIdentifier: string;
  customerPrice: number;
  promoCode: string;
  parentIdentifier: string;
  subscription: string;
  period: string;
  category: string;
  cmb: string;
  device: string;
  supportedPlatforms: string;
  proceedsReason: string;
  preservedPricing: string;
  client: string;
  orderType: string;
}

// Financial Report row from Apple's TSV
// This matches the actual bank payment amounts
export interface FinancialReportRow {
  startDate: string;           // Period start date (MM/DD/YYYY)
  endDate: string;             // Period end date (MM/DD/YYYY)
  upc: string;                 // Not applicable for developers
  isrcIsbn: string;            // SKU for apps, Product ID for IAP
  vendorIdentifier: string;    // SKU or Product ID
  quantity: number;            // Units sold (can be negative for refunds)
  partnerShare: number;        // Proceeds per unit
  extendedPartnerShare: number; // Total proceeds (quantity * partnerShare)
  partnerShareCurrency: string; // Currency of proceeds
  saleOrReturn: string;        // "S" for sale, "R" for return
  appleIdentifier: string;     // Apple ID of the app
  artistShowDeveloper: string; // Your legal entity name
  title: string;               // App name or IAP Product ID
  labelStudioNetwork: string;  // Not applicable
  grid: string;                // Not applicable
  productTypeIdentifier: string; // Type of product
  isanOtherIdentifier: string; // Additional identifier
  countryOfSale: string;       // Two-character country code
  preOrderFlag: string;        // "P" or null
  promoCode: string;           // Promo code if applicable
  customerPrice: number;       // Price charged to customer
  customerCurrency: string;    // Customer's currency
}

// Aggregated earnings per product (app or IAP)
export interface ProductEarnings {
  appleIdentifier: string;
  title: string;
  sku: string;
  productType: string; // Product type identifier (e.g., "1", "IA1", "IAY")
  isIAP: boolean; // True if this is an In-App Purchase
  proceedsByCurrency: Record<string, number>;
  totalProceeds: number; // Converted to target currency
}

// App with its IAPs grouped together
export interface AppWithIAPs {
  appleIdentifier: string;
  title: string;
  sku: string;
  totalProceeds: number; // Total including all IAPs (in target currency)
  appProceeds: number; // Just the app itself (if any direct sales)
  iaps: ProductEarnings[]; // In-App Purchases belonging to this app
}

// Aggregated earnings per app (kept for backwards compatibility)
export interface AppEarnings {
  appleIdentifier: string;
  title: string;
  sku: string;
  proceedsByCurrency: Record<string, number>; // e.g., { "USD": 100.50, "EUR": 50.25 }
  totalProceeds: number; // Converted to target currency
}

// Exchange rates response from Frankfurter API
export interface ExchangeRatesResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

// Cache metadata
export interface CacheMetadata {
  fiscalYear: number;
  fiscalMonth: number;
  downloadedAt: string;
  reportDate: string;
}
