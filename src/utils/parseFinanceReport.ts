import type { FinancialReportRow, ProductEarnings, PaymentInfo } from "../types.js";

/**
 * Column indices for the Financial Report TSV.
 */
const COLUMNS = {
  START_DATE: 0,
  END_DATE: 1,
  UPC: 2,
  ISRC_ISBN: 3,
  VENDOR_IDENTIFIER: 4,
  QUANTITY: 5,
  PARTNER_SHARE: 6,
  EXTENDED_PARTNER_SHARE: 7,
  PARTNER_SHARE_CURRENCY: 8,
  SALE_OR_RETURN: 9,
  APPLE_IDENTIFIER: 10,
  ARTIST_SHOW_DEVELOPER: 11,
  TITLE: 12,
  LABEL_STUDIO_NETWORK: 13,
  GRID: 14,
  PRODUCT_TYPE_IDENTIFIER: 15,
  ISAN_OTHER_IDENTIFIER: 16,
  COUNTRY_OF_SALE: 17,
  PRE_ORDER_FLAG: 18,
  PROMO_CODE: 19,
  CUSTOMER_PRICE: 20,
  CUSTOMER_CURRENCY: 21,
};

/**
 * Parses a single row from the Financial Report TSV.
 */
function parseRow(columns: string[]): FinancialReportRow | null {
  if (columns.length < 12) {
    return null;
  }
  
  const quantity = parseInt(columns[COLUMNS.QUANTITY], 10) || 0;
  const partnerShare = parseFloat(columns[COLUMNS.PARTNER_SHARE]) || 0;
  const extendedPartnerShare = parseFloat(columns[COLUMNS.EXTENDED_PARTNER_SHARE]) || 0;
  const customerPrice = parseFloat(columns[COLUMNS.CUSTOMER_PRICE]) || 0;
  
  return {
    startDate: columns[COLUMNS.START_DATE] || "",
    endDate: columns[COLUMNS.END_DATE] || "",
    upc: columns[COLUMNS.UPC] || "",
    isrcIsbn: columns[COLUMNS.ISRC_ISBN] || "",
    vendorIdentifier: columns[COLUMNS.VENDOR_IDENTIFIER] || "",
    quantity,
    partnerShare,
    extendedPartnerShare,
    partnerShareCurrency: columns[COLUMNS.PARTNER_SHARE_CURRENCY] || "",
    saleOrReturn: columns[COLUMNS.SALE_OR_RETURN] || "",
    appleIdentifier: columns[COLUMNS.APPLE_IDENTIFIER] || "",
    artistShowDeveloper: columns[COLUMNS.ARTIST_SHOW_DEVELOPER] || "",
    title: columns[COLUMNS.TITLE] || "",
    labelStudioNetwork: columns[COLUMNS.LABEL_STUDIO_NETWORK] || "",
    grid: columns[COLUMNS.GRID] || "",
    productTypeIdentifier: columns[COLUMNS.PRODUCT_TYPE_IDENTIFIER] || "",
    isanOtherIdentifier: columns[COLUMNS.ISAN_OTHER_IDENTIFIER] || "",
    countryOfSale: columns[COLUMNS.COUNTRY_OF_SALE] || "",
    preOrderFlag: columns[COLUMNS.PRE_ORDER_FLAG] || "",
    promoCode: columns[COLUMNS.PROMO_CODE] || "",
    customerPrice,
    customerCurrency: columns[COLUMNS.CUSTOMER_CURRENCY] || "",
  };
}

/**
 * Parses the Financial Report TSV content into an array of FinancialReportRow objects.
 */
export function parseFinanceReport(tsvContent: string): FinancialReportRow[] {
  const lines = tsvContent.trim().split("\n");
  
  if (lines.length <= 1) {
    return [];
  }
  
  const rows: FinancialReportRow[] = [];
  
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
 * Aggregates financial report rows by unique product.
 * Uses vendor identifier (SKU) as the unique key since it's unique per product,
 * even if different apps have IAPs with the same display name.
 */
export function aggregateByProduct(rows: FinancialReportRow[]): ProductEarnings[] {
  // Group by vendor identifier (SKU) which is unique per product
  const productMap = new Map<string, ProductEarnings>();
  
  for (const row of rows) {
    if (row.extendedPartnerShare === 0) continue;
    
    // Use vendor identifier as the unique key (it's unique per product)
    const productKey = row.vendorIdentifier || row.appleIdentifier;
    if (!productKey) continue;
    
    let product = productMap.get(productKey);
    
    if (!product) {
      product = {
        appleIdentifier: row.appleIdentifier,
        title: row.title || row.vendorIdentifier,
        sku: row.vendorIdentifier,
        productType: row.productTypeIdentifier,
        isIAP: row.productTypeIdentifier.startsWith("IA"),
        proceedsByCurrency: {},
        totalProceeds: 0,
      };
      productMap.set(productKey, product);
    }
    
    // Aggregate proceeds by currency
    const currency = row.partnerShareCurrency || "USD";
    const currentProceeds = product.proceedsByCurrency[currency] || 0;
    product.proceedsByCurrency[currency] = currentProceeds + row.extendedPartnerShare;
  }
  
  return Array.from(productMap.values());
}

/**
 * Gets all unique currencies from the products.
 */
export function getUniqueCurrencies(products: ProductEarnings[]): string[] {
  const currencies = new Set<string>();
  
  for (const product of products) {
    for (const currency of Object.keys(product.proceedsByCurrency)) {
      currencies.add(currency);
    }
  }
  
  return Array.from(currencies);
}

/**
 * Converts all products to target currency.
 */
export function convertProducts(
  products: ProductEarnings[],
  exchangeRates: Map<string, number>
): ProductEarnings[] {
  return products.map((product) => {
    let total = 0;
    
    for (const [currency, amount] of Object.entries(product.proceedsByCurrency)) {
      const rate = exchangeRates.get(currency) || 1;
      total += amount * rate;
    }
    
    return {
      ...product,
      totalProceeds: total,
    };
  });
}

/**
 * Parses payment information from a financial report.
 * 
 * NOTE: Apple's Finance Reports API does NOT include payment date/status information.
 * Payment details (date, CCI, bank info) are only visible in the App Store Connect web UI.
 * 
 * This function extracts what IS available from the report:
 * - Fiscal period dates from the data rows
 * 
 * It then ESTIMATES payment status based on:
 * - Apple pays ~33 days after the fiscal month ends
 * - If current date > estimated payment date, we assume payment was made
 * 
 * @param tsvContent - The raw TSV content from a financial report
 * @param fiscalPeriodEndDate - End date of fiscal period (optional, will try to extract from report)
 * @returns PaymentInfo object or null if parsing fails
 */
export function parsePaymentInfo(
  tsvContent: string,
  fiscalPeriodEndDate?: Date
): PaymentInfo | null {
  if (!tsvContent || !tsvContent.trim()) {
    return null;
  }

  const lines = tsvContent.trim().split("\n");
  if (lines.length === 0) {
    return null;
  }

  // Currency is not used since we display in target currency
  const currency = "USD";
  
  // Initialize with defaults
  const paymentInfo: PaymentInfo = {
    paymentDate: null,
    paymentAmount: null,
    paymentCurrency: currency,
    exchangeRate: null,
    isPending: true,
    estimatedPaymentDate: null,
    fiscalPeriodStart: "",
    fiscalPeriodEnd: "",
    totalOwed: null,
  };

  // Parse the report to extract:
  // 1. Fiscal period dates from the first data row
  // 2. Total_Amount from the summary footer
  
  let totalAmount: number | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const columns = trimmedLine.split("\t");
    
    // Look for Total_Amount in summary footer
    if (columns[0] === "Total_Amount" && columns.length >= 2) {
      totalAmount = parseFloat(columns[1]);
      if (!isNaN(totalAmount)) {
        paymentInfo.totalOwed = totalAmount;
      }
      continue;
    }
    
    // Extract fiscal period from first data row (skip header)
    // Data rows have dates in MM/DD/YYYY format in columns 0 and 1
    if (!paymentInfo.fiscalPeriodStart && columns.length >= 2) {
      const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      if (datePattern.test(columns[0]) && datePattern.test(columns[1])) {
        paymentInfo.fiscalPeriodStart = columns[0];
        paymentInfo.fiscalPeriodEnd = columns[1];
      }
    }
  }
  
  // Determine fiscal period end date
  let periodEndDate: Date | null = null;
  
  if (fiscalPeriodEndDate) {
    periodEndDate = fiscalPeriodEndDate;
  } else if (paymentInfo.fiscalPeriodEnd) {
    const parts = paymentInfo.fiscalPeriodEnd.split("/");
    if (parts.length === 3) {
      periodEndDate = new Date(
        parseInt(parts[2]),
        parseInt(parts[0]) - 1,
        parseInt(parts[1])
      );
    }
  }
  
  // Calculate estimated payment date (Apple pays ~33 days after fiscal month end)
  if (periodEndDate) {
    const estimatedPaymentDate = new Date(periodEndDate);
    estimatedPaymentDate.setDate(estimatedPaymentDate.getDate() + 33);
    
    paymentInfo.estimatedPaymentDate = formatDateForDisplay(estimatedPaymentDate);
    
    // Determine if payment has likely been made
    // If current date is past the estimated payment date, assume payment was made
    const now = new Date();
    if (now > estimatedPaymentDate) {
      paymentInfo.isPending = false;
      paymentInfo.paymentDate = formatDateForDisplay(estimatedPaymentDate);
      paymentInfo.paymentAmount = paymentInfo.totalOwed;
    }
  }
  
  // Return payment info if we found useful data
  if (paymentInfo.totalOwed !== null || paymentInfo.fiscalPeriodEnd) {
    return paymentInfo;
  }
  
  return null;
}

/**
 * Formats a date for display (e.g., "Nov 1, 2025")
 */
function formatDateForDisplay(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Calculates total proceeds from the consolidated report (ZZ region)
 * for display when region-specific payment info is not available.
 * 
 * @param rows - Parsed financial report rows
 * @param exchangeRates - Exchange rates map (currency -> rate to target currency)
 * @returns Total proceeds in target currency
 */
export function calculateTotalProceeds(
  rows: FinancialReportRow[],
  exchangeRates: Map<string, number>
): number {
  let total = 0;
  
  for (const row of rows) {
    const currency = row.partnerShareCurrency || "USD";
    const rate = exchangeRates.get(currency) || 1;
    total += row.extendedPartnerShare * rate;
  }
  
  return total;
}
