import type { FinancialReportRow, ProductEarnings } from "../types.js";

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
        totalProceedsSGD: 0,
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
 * Applies SGD conversion to all products.
 */
export function convertProductsToSGD(
  products: ProductEarnings[],
  exchangeRates: Map<string, number>
): ProductEarnings[] {
  return products.map((product) => {
    let totalSGD = 0;
    
    for (const [currency, amount] of Object.entries(product.proceedsByCurrency)) {
      const rate = exchangeRates.get(currency) || 1;
      totalSGD += amount * rate;
    }
    
    return {
      ...product,
      totalProceedsSGD: totalSGD,
    };
  });
}
