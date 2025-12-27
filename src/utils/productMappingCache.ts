import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ProductInfo } from "../api/appStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");
const CACHE_DIR = join(PROJECT_ROOT, "cache");
const MAPPING_FILE = join(CACHE_DIR, "product-mapping.json");

// Cache expires after 7 days (product structure doesn't change often)
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedMapping {
  timestamp: number;
  data: Record<string, ProductInfo>;
}

/**
 * Ensures the cache directory exists.
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Checks if the cached product mapping is still valid.
 */
export function isMappingCacheValid(): boolean {
  if (!existsSync(MAPPING_FILE)) {
    return false;
  }
  
  try {
    const content = readFileSync(MAPPING_FILE, "utf-8");
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
  if (!existsSync(MAPPING_FILE)) {
    return null;
  }
  
  try {
    const content = readFileSync(MAPPING_FILE, "utf-8");
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
  ensureCacheDir();
  
  const cached: CachedMapping = {
    timestamp: Date.now(),
    data: Object.fromEntries(mapping),
  };
  
  writeFileSync(MAPPING_FILE, JSON.stringify(cached, null, 2), "utf-8");
}
