import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getCacheDir, ensureDir } from "../config/loader.js";
import type { ProductInfo } from "../api/appStore.js";

/**
 * Gets the mapping cache file path.
 * Uses XDG-compliant location: ~/.cache/appstore-earnings-cli/product-mapping.json
 */
function getMappingFilePath(): string {
  return join(getCacheDir(), "product-mapping.json");
}

// Cache expires after 7 days (product structure doesn't change often)
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedMapping {
  timestamp: number;
  data: Record<string, ProductInfo>;
}

/**
 * Checks if the cached product mapping is still valid.
 */
export function isMappingCacheValid(): boolean {
  const mappingFile = getMappingFilePath();

  if (!existsSync(mappingFile)) {
    return false;
  }

  try {
    const content = readFileSync(mappingFile, "utf-8");
    const cached: CachedMapping = JSON.parse(content);

    const age = Date.now() - cached.timestamp;
    return age < CACHE_EXPIRY_MS;
  } catch {
    return false;
  }
}

/**
 * Reads the cached product mapping.
 */
export function readMappingCache(): Map<string, ProductInfo> | null {
  const mappingFile = getMappingFilePath();

  if (!existsSync(mappingFile)) {
    return null;
  }

  try {
    const content = readFileSync(mappingFile, "utf-8");
    const cached: CachedMapping = JSON.parse(content);

    // Convert object back to Map
    return new Map(Object.entries(cached.data));
  } catch {
    return null;
  }
}

/**
 * Writes the product mapping to cache.
 */
export function writeMappingCache(mapping: Map<string, ProductInfo>): void {
  ensureDir(getCacheDir());

  const cached: CachedMapping = {
    timestamp: Date.now(),
    data: Object.fromEntries(mapping),
  };

  writeFileSync(getMappingFilePath(), JSON.stringify(cached, null, 2), "utf-8");
}
