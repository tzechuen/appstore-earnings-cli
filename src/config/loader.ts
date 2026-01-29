import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AppStoreConnectConfig, AppManagerConfig } from "../types.js";

const APP_NAME = "appstore-earnings-cli";

/**
 * Configuration file structure stored in ~/.config/appstore-earnings-cli/config.json
 */
export interface ConfigFile {
  issuerId?: string;
  keyId?: string;
  privateKeyPath?: string;
  vendorNumber?: string;
  appManagerIssuerId?: string;
  appManagerKeyId?: string;
  appManagerPrivateKeyPath?: string;
  targetCurrency?: string;
}

/**
 * Returns the XDG config directory for the app.
 * Uses $XDG_CONFIG_HOME or defaults to ~/.config
 */
export function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, APP_NAME);
}

/**
 * Returns the XDG cache directory for the app.
 * Uses $ASC_CACHE_DIR, $XDG_CACHE_HOME, or defaults to ~/.cache
 */
export function getCacheDir(): string {
  if (process.env.ASC_CACHE_DIR) {
    return process.env.ASC_CACHE_DIR;
  }
  const xdgCache = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdgCache, APP_NAME);
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Parses a .env file and returns key-value pairs.
 * Does NOT modify process.env - returns a plain object.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Loads config.json from the XDG config directory.
 */
function loadConfigFile(): ConfigFile {
  const configPath = join(getConfigDir(), "config.json");

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as ConfigFile;
  } catch {
    return {};
  }
}

/**
 * Resolves a private key from various sources:
 * 1. Base64 encoded content (prefix: "base64:")
 * 2. Absolute path
 * 3. Path relative to config directory (for keys stored with config)
 * 4. Path relative to current working directory
 */
export function resolvePrivateKey(keyPathOrContent: string): string {
  // Check for base64 encoded key content
  if (keyPathOrContent.startsWith("base64:")) {
    const base64Content = keyPathOrContent.slice(7);
    return Buffer.from(base64Content, "base64").toString("utf-8");
  }

  // Try as absolute path first
  if (existsSync(keyPathOrContent)) {
    return readFileSync(keyPathOrContent, "utf-8");
  }

  // Try relative to config directory (for keys stored in ~/.config/appstore-earnings-cli/keys/)
  const configRelativePath = join(getConfigDir(), keyPathOrContent);
  if (existsSync(configRelativePath)) {
    return readFileSync(configRelativePath, "utf-8");
  }

  // Try relative to CWD
  const cwdRelativePath = join(process.cwd(), keyPathOrContent);
  if (existsSync(cwdRelativePath)) {
    return readFileSync(cwdRelativePath, "utf-8");
  }

  throw new Error(
    `Private key not found: ${keyPathOrContent}\n` +
    `Tried:\n` +
    `  - ${keyPathOrContent} (absolute)\n` +
    `  - ${configRelativePath} (relative to config dir)\n` +
    `  - ${cwdRelativePath} (relative to CWD)`
  );
}

/**
 * Resolves a private key path for storage in config.
 * Returns the path to store (either absolute or relative to config dir).
 */
export function resolveKeyPathForStorage(keyPath: string): string {
  // If it's already base64 encoded, keep as-is
  if (keyPath.startsWith("base64:")) {
    return keyPath;
  }

  // If it's an absolute path that exists, keep it
  if (existsSync(keyPath)) {
    return keyPath;
  }

  // Try relative to CWD
  const cwdRelativePath = join(process.cwd(), keyPath);
  if (existsSync(cwdRelativePath)) {
    return cwdRelativePath;
  }

  // Return as-is and let resolvePrivateKey handle it
  return keyPath;
}

/**
 * Configuration priority chain result.
 */
export interface LoadedConfig {
  // Finance API config (required)
  issuerId: string | null;
  keyId: string | null;
  privateKeyPath: string | null;
  vendorNumber: string | null;

  // App Manager API config (optional)
  appManagerIssuerId: string | null;
  appManagerKeyId: string | null;
  appManagerPrivateKeyPath: string | null;

  // Settings
  targetCurrency: string;

  // Source tracking for debugging
  source: "env" | "dotenv" | "config" | "none";
}

/**
 * Loads configuration using priority chain:
 * 1. Environment variables (highest priority)
 * 2. .env file in current working directory
 * 3. Config file at ~/.config/appstore-earnings-cli/config.json
 *
 * Returns null values for missing required fields (caller should handle).
 */
export function loadConfig(): LoadedConfig {
  // Load all config sources
  const envVars = process.env;
  const dotenvVars = parseEnvFile(join(process.cwd(), ".env"));
  const configFile = loadConfigFile();

  // Helper to get value with priority chain
  const get = (envKey: string, configKey: keyof ConfigFile): string | null => {
    return envVars[envKey] || dotenvVars[envKey] || configFile[configKey] || null;
  };

  // Determine primary source for tracking
  let source: LoadedConfig["source"] = "none";
  if (envVars.ASC_ISSUER_ID || envVars.ASC_KEY_ID) {
    source = "env";
  } else if (dotenvVars.ASC_ISSUER_ID || dotenvVars.ASC_KEY_ID) {
    source = "dotenv";
  } else if (configFile.issuerId || configFile.keyId) {
    source = "config";
  }

  return {
    // Finance API (required)
    issuerId: get("ASC_ISSUER_ID", "issuerId"),
    keyId: get("ASC_KEY_ID", "keyId"),
    privateKeyPath: get("ASC_PRIVATE_KEY_PATH", "privateKeyPath"),
    vendorNumber: get("ASC_VENDOR_NUMBER", "vendorNumber"),

    // App Manager API (optional)
    appManagerIssuerId: get("ASC_APP_MANAGER_ISSUER_ID", "appManagerIssuerId"),
    appManagerKeyId: get("ASC_APP_MANAGER_KEY_ID", "appManagerKeyId"),
    appManagerPrivateKeyPath: get("ASC_APP_MANAGER_PRIVATE_KEY_PATH", "appManagerPrivateKeyPath"),

    // Settings
    targetCurrency: get("TARGET_CURRENCY", "targetCurrency") || "USD",

    source,
  };
}

/**
 * Validates loaded config and returns AppStoreConnectConfig if valid.
 * Throws an error with helpful message if config is incomplete.
 */
export function validateFinanceConfig(config: LoadedConfig): AppStoreConnectConfig {
  const missing: string[] = [];

  if (!config.issuerId) missing.push("ASC_ISSUER_ID / issuerId");
  if (!config.keyId) missing.push("ASC_KEY_ID / keyId");
  if (!config.privateKeyPath) missing.push("ASC_PRIVATE_KEY_PATH / privateKeyPath");
  if (!config.vendorNumber) missing.push("ASC_VENDOR_NUMBER / vendorNumber");

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(", ")}\n\n` +
      `Configuration can be provided via:\n` +
      `  1. Environment variables (ASC_ISSUER_ID, ASC_KEY_ID, etc.)\n` +
      `  2. .env file in current directory\n` +
      `  3. Config file at ${join(getConfigDir(), "config.json")}\n\n` +
      `Run with --setup to configure interactively.`
    );
  }

  return {
    issuerId: config.issuerId!,
    keyId: config.keyId!,
    privateKeyPath: config.privateKeyPath!,
    vendorNumber: config.vendorNumber!,
  };
}

/**
 * Validates and returns App Manager config if fully configured.
 * Returns null if not configured (optional feature).
 */
export function validateAppManagerConfig(config: LoadedConfig): AppManagerConfig | null {
  const { appManagerIssuerId, appManagerKeyId, appManagerPrivateKeyPath } = config;

  // All three must be present, or none
  if (!appManagerIssuerId && !appManagerKeyId && !appManagerPrivateKeyPath) {
    return null;
  }

  const missing: string[] = [];

  if (!appManagerIssuerId) missing.push("ASC_APP_MANAGER_ISSUER_ID");
  if (!appManagerKeyId) missing.push("ASC_APP_MANAGER_KEY_ID");
  if (!appManagerPrivateKeyPath) missing.push("ASC_APP_MANAGER_PRIVATE_KEY_PATH");

  if (missing.length > 0) {
    console.warn(
      `Warning: Partial App Manager config. Missing: ${missing.join(", ")}\n` +
      `App grouping feature will be disabled.`
    );
    return null;
  }

  return {
    issuerId: appManagerIssuerId!,
    keyId: appManagerKeyId!,
    privateKeyPath: appManagerPrivateKeyPath!,
  };
}

/**
 * Checks if configuration exists from any source.
 */
export function hasConfiguration(): boolean {
  const config = loadConfig();
  return config.source !== "none";
}

/**
 * Gets the path to the config file.
 */
export function getConfigFilePath(): string {
  return join(getConfigDir(), "config.json");
}
