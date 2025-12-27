import { gunzipSync } from "zlib";
import { generateToken } from "./auth.js";
import type { AppStoreConnectConfig, CalendarMonth } from "../types.js";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1/financeReports";

/**
 * Downloads a financial report from the App Store Connect API.
 * 
 * Financial reports show actual proceeds based on settled transactions,
 * matching what you receive in your bank account.
 * 
 * The API returns a gzipped TSV file which we decompress and return as a string.
 */
export async function downloadFinanceReport(
  config: AppStoreConnectConfig,
  month: CalendarMonth
): Promise<string> {
  const token = generateToken(config);
  
  // Finance Reports use regionCode instead of just vendorNumber
  // Use ZZ for consolidated report (all regions)
  const queryString = new URLSearchParams({
    "filter[regionCode]": "ZZ", // ZZ = All regions consolidated
    "filter[reportDate]": month.reportDate,
    "filter[reportType]": "FINANCIAL",
    "filter[vendorNumber]": config.vendorNumber,
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
  constructor(month: CalendarMonth) {
    super(`No financial report available for ${month.displayName}. Reports are typically available by the 5th of the following month.`);
    this.name = "NoReportAvailableError";
  }
}

/**
 * Downloads a financial report, handling the case where no report exists.
 */
export async function fetchFinanceReport(
  config: AppStoreConnectConfig,
  month: CalendarMonth
): Promise<string> {
  try {
    return await downloadFinanceReport(config, month);
  } catch (error) {
    if (error instanceof Error) {
      // Apple returns 404 when no report exists
      if (error.message.includes("404") || error.message.toLowerCase().includes("not found")) {
        throw new NoReportAvailableError(month);
      }
    }
    throw error;
  }
}
