import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getCacheDir, ensureDir } from "../config/loader.js";
import type { CalendarMonth } from "../types.js";

/**
 * Gets the cache directory path.
 * Uses XDG-compliant location: ~/.cache/appstore-earnings-cli/reports
 */
function getReportsCacheDir(): string {
  return join(getCacheDir(), "reports");
}

/**
 * Ensures the cache directory exists.
 */
function ensureCacheDir(): void {
  ensureDir(getReportsCacheDir());
}

/**
 * Gets the cache filename for a calendar month.
 */
function getCacheFilename(month: CalendarMonth): string {
  return `${month.year}-${month.month.toString().padStart(2, "0")}.tsv`;
}

/**
 * Gets the full path to a cached report file.
 */
function getCachePath(month: CalendarMonth): string {
  return join(getReportsCacheDir(), getCacheFilename(month));
}

/**
 * Checks if a cached report exists for the given month.
 */
export function isCached(month: CalendarMonth): boolean {
  return existsSync(getCachePath(month));
}

/**
 * Reads a cached report for the given month.
 * Returns null if not cached.
 */
export function readCache(month: CalendarMonth): string | null {
  const cachePath = getCachePath(month);

  if (!existsSync(cachePath)) {
    return null;
  }

  return readFileSync(cachePath, "utf-8");
}

/**
 * Writes a report to the cache.
 */
export function writeCache(month: CalendarMonth, content: string): void {
  ensureCacheDir();

  const cachePath = getCachePath(month);

  // Write the report content
  writeFileSync(cachePath, content, "utf-8");
}
