import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { input, confirm, select } from "@inquirer/prompts";
import { getConfigDir, ensureDir, type ConfigFile } from "./loader.js";

/**
 * Validates that a file exists and is readable.
 */
function validateFileExists(path: string): boolean | string {
  if (!existsSync(path)) {
    return `File not found: ${path}`;
  }
  try {
    readFileSync(path, "utf-8");
    return true;
  } catch {
    return `Cannot read file: ${path}`;
  }
}

/**
 * Validates a UUID format (for Issuer ID).
 */
function validateUUID(value: string): boolean | string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return "Invalid format. Expected UUID like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
  }
  return true;
}

/**
 * Validates a Key ID format (10 alphanumeric characters).
 */
function validateKeyId(value: string): boolean | string {
  if (!/^[A-Z0-9]{10}$/.test(value)) {
    return "Invalid format. Expected 10 alphanumeric characters like: XXXXXXXXXX";
  }
  return true;
}

/**
 * Validates a vendor number (numeric).
 */
function validateVendorNumber(value: string): boolean | string {
  if (!/^\d+$/.test(value)) {
    return "Invalid format. Expected numeric vendor number like: 12345678";
  }
  return true;
}

/**
 * Runs the interactive setup wizard.
 * Prompts for all required configuration and saves to config.json.
 */
export async function runSetupWizard(): Promise<void> {
  console.log("\n  App Store Earnings CLI - Setup Wizard\n");
  console.log("  This wizard will help you configure the CLI for first-time use.\n");
  console.log("  You'll need:");
  console.log("    - App Store Connect API Key (Finance role) with .p8 file");
  console.log("    - Your Vendor Number from Payments and Financial Reports");
  console.log("    - Optionally: App Manager API Key for grouping IAPs\n");

  const configDir = getConfigDir();
  const keysDir = join(configDir, "keys");
  const configPath = join(configDir, "config.json");

  // Check if config already exists
  if (existsSync(configPath)) {
    const overwrite = await confirm({
      message: "Configuration already exists. Overwrite?",
      default: false,
    });

    if (!overwrite) {
      console.log("\nSetup cancelled.\n");
      return;
    }
  }

  // Finance API Key (Required)
  console.log("\n  --- Finance API Key (Required) ---\n");

  const issuerId = await input({
    message: "Issuer ID:",
    validate: validateUUID,
  });

  const keyId = await input({
    message: "Key ID:",
    validate: validateKeyId,
  });

  const privateKeyPath = await input({
    message: "Path to .p8 private key file:",
    validate: (value) => {
      if (!value) return "Path is required";
      const result = validateFileExists(value);
      if (result !== true) return result;
      if (!value.endsWith(".p8")) return "File should be a .p8 key file";
      return true;
    },
  });

  const vendorNumber = await input({
    message: "Vendor Number:",
    validate: validateVendorNumber,
  });

  // Ask about copying key file to config directory
  let finalKeyPath = privateKeyPath;

  const copyKey = await confirm({
    message: "Copy .p8 file to config directory for portability?",
    default: true,
  });

  if (copyKey) {
    ensureDir(keysDir);
    const keyFilename = basename(privateKeyPath);
    const destPath = join(keysDir, keyFilename);

    try {
      copyFileSync(privateKeyPath, destPath);
      finalKeyPath = join("keys", keyFilename); // Store as relative path
      console.log(`  Copied to: ${destPath}`);
    } catch (error) {
      console.warn(`  Warning: Could not copy key file: ${(error as Error).message}`);
      console.warn(`  Using original path: ${privateKeyPath}`);
    }
  }

  // App Manager API Key (Optional)
  console.log("\n  --- App Manager API Key (Optional) ---\n");
  console.log("  This enables grouping In-App Purchases under their parent apps.\n");

  const configureAppManager = await confirm({
    message: "Configure App Manager API Key?",
    default: false,
  });

  let appManagerConfig: Partial<ConfigFile> = {};

  if (configureAppManager) {
    const appManagerIssuerId = await input({
      message: "App Manager Issuer ID:",
      validate: validateUUID,
    });

    const appManagerKeyId = await input({
      message: "App Manager Key ID:",
      validate: validateKeyId,
    });

    const appManagerPrivateKeyPath = await input({
      message: "Path to App Manager .p8 private key file:",
      validate: (value) => {
        if (!value) return "Path is required";
        const result = validateFileExists(value);
        if (result !== true) return result;
        if (!value.endsWith(".p8")) return "File should be a .p8 key file";
        return true;
      },
    });

    let finalAppManagerKeyPath = appManagerPrivateKeyPath;

    const copyAppManagerKey = await confirm({
      message: "Copy App Manager .p8 file to config directory?",
      default: true,
    });

    if (copyAppManagerKey) {
      ensureDir(keysDir);
      const keyFilename = basename(appManagerPrivateKeyPath);
      const destPath = join(keysDir, keyFilename);

      try {
        copyFileSync(appManagerPrivateKeyPath, destPath);
        finalAppManagerKeyPath = join("keys", keyFilename);
        console.log(`  Copied to: ${destPath}`);
      } catch (error) {
        console.warn(`  Warning: Could not copy key file: ${(error as Error).message}`);
        console.warn(`  Using original path: ${appManagerPrivateKeyPath}`);
      }
    }

    appManagerConfig = {
      appManagerIssuerId,
      appManagerKeyId,
      appManagerPrivateKeyPath: finalAppManagerKeyPath,
    };
  }

  // Target Currency
  console.log("\n  --- Settings ---\n");

  const targetCurrency = await select({
    message: "Default target currency:",
    choices: [
      { name: "USD - US Dollar", value: "USD" },
      { name: "EUR - Euro", value: "EUR" },
      { name: "GBP - British Pound", value: "GBP" },
      { name: "SGD - Singapore Dollar", value: "SGD" },
      { name: "JPY - Japanese Yen", value: "JPY" },
      { name: "AUD - Australian Dollar", value: "AUD" },
      { name: "CAD - Canadian Dollar", value: "CAD" },
      { name: "CHF - Swiss Franc", value: "CHF" },
      { name: "CNY - Chinese Yuan", value: "CNY" },
      { name: "Other (enter manually)", value: "OTHER" },
    ],
  });

  let finalCurrency = targetCurrency;

  if (targetCurrency === "OTHER") {
    finalCurrency = await input({
      message: "Enter currency code (3 letters):",
      validate: (value) => {
        if (!/^[A-Z]{3}$/.test(value.toUpperCase())) {
          return "Invalid format. Expected 3-letter currency code like: USD, EUR, GBP";
        }
        return true;
      },
      transformer: (value) => value.toUpperCase(),
    });
    finalCurrency = finalCurrency.toUpperCase();
  }

  // Build config object
  const config: ConfigFile = {
    issuerId,
    keyId,
    privateKeyPath: finalKeyPath,
    vendorNumber,
    targetCurrency: finalCurrency,
    ...appManagerConfig,
  };

  // Save config
  ensureDir(configDir);
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  console.log("\n  Configuration saved!\n");
  console.log(`  Config file: ${configPath}`);
  if (existsSync(keysDir)) {
    console.log(`  Keys directory: ${keysDir}`);
  }
  console.log("\n  You can now run the CLI without any additional setup.\n");
}

/**
 * Shows configuration status and location.
 */
export function showConfigStatus(): void {
  const configDir = getConfigDir();
  const configPath = join(configDir, "config.json");

  console.log("\n  Configuration Status\n");

  if (existsSync(configPath)) {
    console.log(`  Config file: ${configPath}`);
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8")) as ConfigFile;
      console.log(`  Issuer ID: ${config.issuerId ? "configured" : "missing"}`);
      console.log(`  Key ID: ${config.keyId ? "configured" : "missing"}`);
      console.log(`  Private Key: ${config.privateKeyPath ? "configured" : "missing"}`);
      console.log(`  Vendor Number: ${config.vendorNumber ? "configured" : "missing"}`);
      console.log(`  App Manager: ${config.appManagerKeyId ? "configured" : "not configured"}`);
      console.log(`  Currency: ${config.targetCurrency || "USD (default)"}`);
    } catch {
      console.log("  (Error reading config file)");
    }
  } else {
    console.log("  No configuration file found.");
    console.log(`  Expected location: ${configPath}`);
  }

  // Check for .env file
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    console.log(`\n  .env file: ${envPath}`);
  }

  console.log("\n  Run with --setup to configure interactively.\n");
}
