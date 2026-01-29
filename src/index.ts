import { select } from "@inquirer/prompts";

import { loadConfig, loadAppManagerConfig } from "./api/auth.js";
import { fetchFinanceReport, NoReportAvailableError } from "./api/financeReports.js";
import { fetchExchangeRates, formatCurrency, getTargetCurrency } from "./api/exchangeRates.js";
import { buildProductMapping, type ProductInfo } from "./api/appStore.js";
import { getRecentCalendarMonths } from "./utils/calendarMonths.js";
import {
  parseFinanceReport,
  aggregateByProduct,
  getUniqueCurrencies,
  convertProducts,
  parsePaymentInfo,
} from "./utils/parseFinanceReport.js";
import { isCached, readCache, writeCache } from "./utils/cache.js";
import {
  isMappingCacheValid,
  readMappingCache,
  writeMappingCache,
} from "./utils/productMappingCache.js";
import { hasConfiguration, getConfigFilePath } from "./config/loader.js";
import { runSetupWizard, showConfigStatus } from "./config/setup.js";
import type { CalendarMonth, ProductEarnings, AppWithIAPs, PaymentInfo } from "./types.js";

// Check for flags
const useCache = !process.argv.includes("--no-cache");
const refreshMapping = process.argv.includes("--refresh-mapping");
const runSetup = process.argv.includes("--setup");
const showStatus = process.argv.includes("--status");

async function main(): Promise<void> {
  // Handle --status flag
  if (showStatus) {
    showConfigStatus();
    return;
  }

  // Handle --setup flag or first-run experience
  if (runSetup) {
    await runSetupWizard();
    return;
  }

  // Check if configuration exists
  if (!hasConfiguration()) {
    console.log("\n  App Store Earnings CLI\n");
    console.log("  No configuration found.\n");
    console.log("  Would you like to set up now?\n");

    const shouldSetup = await select({
      message: "Choose an option:",
      choices: [
        { name: "Run setup wizard", value: "setup" },
        { name: "Show configuration help", value: "help" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (shouldSetup === "setup") {
      await runSetupWizard();
      console.log("  Rerun the command to view earnings.\n");
      return;
    } else if (shouldSetup === "help") {
      console.log("\n  Configuration can be provided via:\n");
      console.log("    1. Environment variables:");
      console.log("       ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY_PATH, ASC_VENDOR_NUMBER\n");
      console.log("    2. .env file in current directory\n");
      console.log(`    3. Config file at ${getConfigFilePath()}\n`);
      console.log("  Run with --setup to configure interactively.\n");
      return;
    } else {
      return;
    }
  }

  console.log("\n  App Store Earnings CLI\n");

  // Load Finance API configuration (required)
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`\nError: ${(error as Error).message}\n`);
    process.exit(1);
  }

  // Load App Manager API configuration (optional - for app grouping)
  const appManagerConfig = loadAppManagerConfig();

  // Get or build product mapping (apps + IAPs)
  let productMapping: Map<string, ProductInfo> | null = null;

  if (appManagerConfig) {
    if (!refreshMapping && isMappingCacheValid()) {
      console.log("Using cached product mapping...");
      productMapping = readMappingCache();
    } else {
      console.log("Building product mapping...");
      try {
        productMapping = await buildProductMapping(appManagerConfig);
        writeMappingCache(productMapping);
        console.log("Product mapping cached.\n");
      } catch (error) {
        console.warn(`Warning: Could not fetch app data: ${(error as Error).message}`);
        console.log("Continuing without app grouping...\n");
      }
    }

    // Debug: show mapping summary
    if (process.env.DEBUG && productMapping) {
      const apps = new Set<string>();
      let iapCount = 0;
      for (const info of productMapping.values()) {
        apps.add(info.parentAppName);
        if (info.isIAP) iapCount++;
      }
      console.log(`\n[DEBUG] Mapping: ${apps.size} apps, ${iapCount} IAPs/subscriptions\n`);
    }
  }

  // Get list of calendar months
  const months = getRecentCalendarMonths(24);

  // Prompt user to select a month
  const selectedMonth = await select<CalendarMonth>({
    message: "Select month:",
    choices: months.map((month) => ({
      name: month.displayName,
      value: month,
    })),
  });

  // Workaround: Bun has an issue where async crypto operations (jose JWT signing)
  // can hang after interactive TTY input. This setImmediate lets the event loop settle.
  await new Promise(resolve => setImmediate(resolve));

  console.log(`\nFetching financial report for ${selectedMonth.displayName}...`);

  // Check cache first
  let reportContent: string;

  if (useCache && isCached(selectedMonth)) {
    console.log("Using cached report...");
    reportContent = readCache(selectedMonth)!;
  } else {
    // Download from API
    try {
      reportContent = await fetchFinanceReport(config, selectedMonth);

      // Cache the report
      if (useCache) {
        writeCache(selectedMonth, reportContent);
        console.log("Report cached for future use.");
      }
    } catch (error) {
      if (error instanceof NoReportAvailableError) {
        console.error(`\n${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
  }

  // Debug: Show first few lines of report to understand format
  if (process.env.DEBUG) {
    console.log("\n--- Report Preview (first 500 chars) ---");
    console.log(reportContent.substring(0, 500));
    console.log("---\n");
  }

  // Parse the report
  const rows = parseFinanceReport(reportContent);

  if (rows.length === 0) {
    console.log("\nNo financial data found for this period.\n");
    console.log("Hint: Run with DEBUG=1 to see raw report content.");
    process.exit(0);
  }

  // Aggregate by product
  let products = aggregateByProduct(rows);

  if (products.length === 0) {
    console.log("\nNo earnings for this period.\n");
    process.exit(0);
  }

  // Get unique currencies and fetch exchange rates
  const currencies = getUniqueCurrencies(products);
  const targetCurrency = getTargetCurrency();

  console.log(`Converting currencies to ${targetCurrency}...`);
  const exchangeRates = await fetchExchangeRates(currencies);

  // Convert to target currency
  products = convertProducts(products, exchangeRates);

  // Parse payment information from the consolidated report
  // Extracts fiscal period dates and estimates payment status based on timing
  const paymentInfo = parsePaymentInfo(reportContent);

  // Group products by parent app if we have a mapping
  if (productMapping && productMapping.size > 0) {
    const apps = groupByParentApp(products, productMapping);
    apps.sort((a, b) => b.totalProceeds - a.totalProceeds);
    displayEarningsTree(apps, selectedMonth, paymentInfo);
  } else {
    // Flat display without grouping
    products.sort((a, b) => b.totalProceeds - a.totalProceeds);
    displayFlatList(products, selectedMonth, paymentInfo);
  }
}

/**
 * Groups products by their parent app using the product mapping.
 */
function groupByParentApp(
  products: ProductEarnings[],
  mapping: Map<string, ProductInfo>
): AppWithIAPs[] {
  const appMap = new Map<string, AppWithIAPs>();

  for (const product of products) {
    // Look up product in mapping:
    // 1. Try SKU (vendor identifier) - works for IAPs/subscriptions
    // 2. Try Apple Identifier (numeric ID) - works for apps and as fallback
    const info = mapping.get(product.sku) || mapping.get(product.appleIdentifier);

    // Determine parent app
    let parentAppName: string;
    let parentAppId: string;
    let isIAP: boolean;

    if (info) {
      parentAppName = info.parentAppName;
      parentAppId = info.parentAppId;
      isIAP = info.isIAP;
    } else {
      // Fallback: use the product itself as the "app"
      parentAppName = product.title;
      parentAppId = product.appleIdentifier || product.sku;
      isIAP = product.isIAP;
    }

    // Get or create the app entry
    let app = appMap.get(parentAppId);

    if (!app) {
      app = {
        appleIdentifier: parentAppId,
        title: parentAppName,
        sku: "",
        totalProceeds: 0,
        appProceeds: 0,
        iaps: [],
      };
      appMap.set(parentAppId, app);
    }

    // Add to the appropriate place
    if (isIAP) {
      app.iaps.push(product);
    } else {
      app.appProceeds += product.totalProceeds;
    }

    app.totalProceeds += product.totalProceeds;
  }

  // Sort IAPs within each app
  for (const app of appMap.values()) {
    app.iaps.sort((a, b) => b.totalProceeds - a.totalProceeds);
  }

  return Array.from(appMap.values());
}

/**
 * Displays earnings in a tree format with apps and their IAPs.
 */
function displayEarningsTree(apps: AppWithIAPs[], month: CalendarMonth, paymentInfo: PaymentInfo | null): void {
  console.log(`\n  Earnings for ${month.displayName}\n`);

  let grandTotal = 0;

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const isLastApp = i === apps.length - 1;

    grandTotal += app.totalProceeds;

    // App header with tree branch
    const appPrefix = isLastApp ? "└── " : "├── ";
    const truncatedTitle = app.title.length > 32
      ? app.title.substring(0, 29) + "..."
      : app.title;

    console.log(
      `${appPrefix}${truncatedTitle.padEnd(35)} ${formatCurrency(app.totalProceeds).padStart(12)}`
    );

    // Show IAPs under the app
    const childPrefix = isLastApp ? "    " : "│   ";

    // If app has direct sales, show it
    if (app.appProceeds > 0) {
      const hasIAPs = app.iaps.length > 0;
      const directBranch = hasIAPs ? "├── " : "└── ";
      console.log(
        `${childPrefix}${directBranch}${"(App Sales)".padEnd(31)} ${formatCurrency(app.appProceeds).padStart(12)}`
      );
    }

    // Show IAPs
    for (let j = 0; j < app.iaps.length; j++) {
      const iap = app.iaps[j];
      const isLastIAP = j === app.iaps.length - 1;
      const iapBranch = isLastIAP ? "└── " : "├── ";

      const iapTitle = iap.title.length > 28
        ? iap.title.substring(0, 25) + "..."
        : iap.title;

      console.log(
        `${childPrefix}${iapBranch}${iapTitle.padEnd(31)} ${formatCurrency(iap.totalProceeds).padStart(12)}`
      );
    }

    // Add spacing between apps
    if (!isLastApp) {
      console.log("│");
    }
  }

  // Print total
  console.log("");
  console.log("─".repeat(53));
  console.log(`${"TOTAL".padStart(39)} ${formatCurrency(grandTotal).padStart(12)}`);

  // Display payment info
  displayPaymentSummary(paymentInfo, grandTotal);
}

/**
 * Displays earnings as a flat list (fallback when no mapping available).
 */
function displayFlatList(products: ProductEarnings[], month: CalendarMonth, paymentInfo: PaymentInfo | null): void {
  console.log(`\n  Earnings for ${month.displayName}\n`);

  let total = 0;

  for (const product of products) {
    const title = product.title.length > 40
      ? product.title.substring(0, 37) + "..."
      : product.title;
    const typeLabel = product.isIAP ? "[IAP]" : "[App]";

    console.log(
      `  ${title.padEnd(42)} ${typeLabel} ${formatCurrency(product.totalProceeds).padStart(10)}`
    );
    total += product.totalProceeds;
  }

  console.log("");
  console.log("─".repeat(65));
  console.log(`${"TOTAL".padStart(50)} ${formatCurrency(total).padStart(12)}`);

  // Display payment info
  displayPaymentSummary(paymentInfo, total);
}

/**
 * Displays payment summary information as a footer.
 *
 * NOTE: Apple's Finance Reports API does not include actual payment date/status.
 * Payment status is ESTIMATED based on Apple's typical payment schedule (~33 days
 * after fiscal month end). Actual payment dates may vary slightly.
 *
 * The amount shown is the same as the TOTAL (in target currency), which represents
 * the combined proceeds from all regions after currency conversion.
 */
function displayPaymentSummary(paymentInfo: PaymentInfo | null, totalProceeds: number): void {
  console.log("");

  if (!paymentInfo) {
    console.log("  Payment Info: Not available");
    console.log("");
    return;
  }

  // Use the calculated total in target currency (approximate due to FX fluctuations)
  const amount = formatCurrency(totalProceeds);

  if (paymentInfo.isPending) {
    // Payment is pending
    console.log("  Payment Status: Pending");
    console.log(`  Amount: ~${amount}`);

    if (paymentInfo.estimatedPaymentDate) {
      console.log(`  Expected Payment: ~${paymentInfo.estimatedPaymentDate}`);
    }
  } else {
    // Payment likely made (based on timing estimate)
    console.log("  Payment Status: Paid (estimated)");

    if (paymentInfo.paymentDate) {
      console.log(`  Payment Date: ~${paymentInfo.paymentDate}`);
    }

    console.log(`  Amount: ~${amount}`);
  }

  console.log("");
}

// Run the CLI
main().catch((error) => {
  console.error("\nError:", error.message);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});
