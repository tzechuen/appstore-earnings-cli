import { SignJWT, importPKCS8 } from "jose";
import {
  loadConfig as loadConfigFromLoader,
  validateFinanceConfig,
  validateAppManagerConfig,
  resolvePrivateKey,
} from "../config/loader.js";
import type { AppStoreConnectConfig, AppManagerConfig } from "../types.js";

const TOKEN_EXPIRY_SECONDS = 20 * 60; // 20 minutes (Apple's max)

/**
 * Generates a signed JWT token for App Store Connect API authentication.
 *
 * The token is signed using ES256 algorithm with the private key from the .p8 file.
 * Apple requires specific claims: iss (issuer ID), iat (issued at), exp (expiry), aud (audience).
 */
export async function generateToken(config: AppStoreConnectConfig | AppManagerConfig): Promise<string> {
  const privateKeyPem = resolvePrivateKey(config.privateKeyPath);
  const privateKey = await importPKCS8(privateKeyPem, "ES256");

  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId, typ: "JWT" })
    .setIssuer(config.issuerId)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_EXPIRY_SECONDS)
    .setAudience("appstoreconnect-v1")
    .sign(privateKey);

  return token;
}

/**
 * Loads Finance API configuration from config sources.
 * Used for downloading financial reports.
 */
export function loadConfig(): AppStoreConnectConfig {
  const config = loadConfigFromLoader();
  return validateFinanceConfig(config);
}

/**
 * Loads App Manager API configuration from config sources.
 * Used for fetching app and IAP metadata.
 * Returns null if not configured (optional feature).
 */
export function loadAppManagerConfig(): AppManagerConfig | null {
  const config = loadConfigFromLoader();
  return validateAppManagerConfig(config);
}

/**
 * Gets the target currency from configuration.
 */
export function getTargetCurrencyFromConfig(): string {
  const config = loadConfigFromLoader();
  return config.targetCurrency;
}
