import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import type { AppStoreConnectConfig, AppManagerConfig } from "../types.js";

const TOKEN_EXPIRY_SECONDS = 20 * 60; // 20 minutes (Apple's max)

/**
 * Generates a signed JWT token for App Store Connect API authentication.
 * 
 * The token is signed using ES256 algorithm with the private key from the .p8 file.
 * Apple requires specific claims: iss (issuer ID), iat (issued at), exp (expiry), aud (audience).
 */
export function generateToken(config: AppStoreConnectConfig | AppManagerConfig): string {
  const privateKey = readFileSync(config.privateKeyPath, "utf8");
  
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    aud: "appstoreconnect-v1",
  };
  
  const token = jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: config.keyId,
      typ: "JWT",
    },
  });
  
  return token;
}

/**
 * Loads Finance API configuration from environment variables.
 * Used for downloading financial reports.
 */
export function loadConfig(): AppStoreConnectConfig {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  const privateKeyPath = process.env.ASC_PRIVATE_KEY_PATH;
  const vendorNumber = process.env.ASC_VENDOR_NUMBER;
  
  const missing: string[] = [];
  
  if (!issuerId) missing.push("ASC_ISSUER_ID");
  if (!keyId) missing.push("ASC_KEY_ID");
  if (!privateKeyPath) missing.push("ASC_PRIVATE_KEY_PATH");
  if (!vendorNumber) missing.push("ASC_VENDOR_NUMBER");
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please copy .env.example to .env and fill in your credentials.`
    );
  }
  
  return {
    issuerId: issuerId!,
    keyId: keyId!,
    privateKeyPath: privateKeyPath!,
    vendorNumber: vendorNumber!,
  };
}

/**
 * Loads App Manager API configuration from environment variables.
 * Used for fetching app and IAP metadata.
 * Returns null if not configured (optional feature).
 */
export function loadAppManagerConfig(): AppManagerConfig | null {
  const issuerId = process.env.ASC_APP_MANAGER_ISSUER_ID;
  const keyId = process.env.ASC_APP_MANAGER_KEY_ID;
  const privateKeyPath = process.env.ASC_APP_MANAGER_PRIVATE_KEY_PATH;
  
  // All three must be present, or none (optional feature)
  if (!issuerId && !keyId && !privateKeyPath) {
    return null;
  }
  
  const missing: string[] = [];
  
  if (!issuerId) missing.push("ASC_APP_MANAGER_ISSUER_ID");
  if (!keyId) missing.push("ASC_APP_MANAGER_KEY_ID");
  if (!privateKeyPath) missing.push("ASC_APP_MANAGER_PRIVATE_KEY_PATH");
  
  if (missing.length > 0) {
    console.warn(
      `Warning: Partial App Manager config. Missing: ${missing.join(", ")}\n` +
      `App grouping feature will be disabled.`
    );
    return null;
  }
  
  return {
    issuerId: issuerId!,
    keyId: keyId!,
    privateKeyPath: privateKeyPath!,
  };
}
