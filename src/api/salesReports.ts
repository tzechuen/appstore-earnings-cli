import { gunzipSync } from "zlib";
import { generateToken } from "./auth.js";
import type { AppStoreConnectConfig, FiscalMonth } from "../types.js";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1/salesReports";

interface SalesReportParams {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  reportSubType: "SUMMARY" | "DETAILED" | "OPT_IN";
  reportType: "SALES" | "PRE_ORDER" | "NEWSSTAND" | "SUBSCRIPTION" | "SUBSCRIPTION_EVENT" | "SUBSCRIBER";
  vendorNumber: string;
  reportDate: string; // YYYY-MM for monthly
}

/**
 * Downloads a sales report from the App Store Connect API.
 * 
 * The API returns a gzipped TSV file which we decompress and return as a string.
 */
export async function downloadSalesReport(
  config: AppStoreConnectConfig,
  fiscalMonth: FiscalMonth
): Promise<string> {
  const token = generateToken(config);
  
  const params: SalesReportParams = {
    frequency: "MONTHLY",
    reportSubType: "SUMMARY",
    reportType: "SALES",
    vendorNumber: config.vendorNumber,
    reportDate: fiscalMonth.reportDate,
  };
  
  // Apple's API requires filter[] prefix for all parameters
  const queryString = new URLSearchParams({
    "filter[frequency]": params.frequency,
    "filter[reportSubType]": params.reportSubType,
    "filter[reportType]": params.reportType,
    "filter[vendorNumber]": params.vendorNumber,
    "filter[reportDate]": params.reportDate,
  }).toString();
  const url = `${BASE_URL}?${queryString}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/a-gzip, application/json",
    },
  });
  
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const errorData = await response.json();
      const errors = errorData.errors || [];
      const errorMessages = errors.map((e: { detail?: string; title?: string }) => 
        e.detail || e.title || "Unknown error"
      ).join(", ");
      throw new Error(`API Error (${response.status}): ${errorMessages}`);
    }
    throw new Error(`API Error (${response.status}): ${response.statusText}`);
  }
  
  // Check if response is gzipped
  const contentType = response.headers.get("content-type");
  const buffer = await response.arrayBuffer();
  
  if (contentType?.includes("gzip") || contentType?.includes("application/a-gzip")) {
    // Decompress gzipped response
    const decompressed = gunzipSync(Buffer.from(buffer));
    return decompressed.toString("utf-8");
  }
  
  // If not gzipped, return as-is
  return Buffer.from(buffer).toString("utf-8");
}

/**
 * Error class for when no report is available for the requested period.
 */
export class NoReportAvailableError extends Error {
  constructor(fiscalMonth: FiscalMonth) {
    super(`No sales report available for ${fiscalMonth.displayName}. Reports may take a few days to become available after the fiscal month ends.`);
    this.name = "NoReportAvailableError";
  }
}

/**
 * Downloads a sales report, handling the case where no report exists.
 */
export async function fetchSalesReport(
  config: AppStoreConnectConfig,
  fiscalMonth: FiscalMonth
): Promise<string> {
  try {
    return await downloadSalesReport(config, fiscalMonth);
  } catch (error) {
    if (error instanceof Error) {
      // Apple returns 404 when no report exists
      if (error.message.includes("404") || error.message.toLowerCase().includes("not found")) {
        throw new NoReportAvailableError(fiscalMonth);
      }
    }
    throw error;
  }
}
