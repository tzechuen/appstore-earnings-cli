import type { FiscalMonth } from "../types.js";

/**
 * Apple's fiscal year starts on the last Sunday of September.
 * Each fiscal quarter has 13 weeks, with months being either 4 or 5 weeks.
 * 
 * Q1: October (5 weeks), November (4 weeks), December (4 weeks)
 * Q2: January (5 weeks), February (4 weeks), March (4 weeks)
 * Q3: April (5 weeks), May (4 weeks), June (4 weeks)
 * Q4: July (5 weeks), August (4 weeks), September (4 weeks)
 * 
 * Fiscal month 1 = October, Fiscal month 12 = September
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Weeks per fiscal month (1-indexed, fiscal month 1 = October)
const WEEKS_PER_FISCAL_MONTH = [5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4];

/**
 * Finds the last Sunday of September for a given year.
 * This is the start of Apple's fiscal year.
 */
function getLastSundayOfSeptember(year: number): Date {
  // Start from September 30th and work backwards to find Sunday
  const date = new Date(year, 8, 30); // September 30
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

/**
 * Gets the start date of a fiscal year.
 * Fiscal year 2025 starts in late September 2024.
 */
function getFiscalYearStart(fiscalYear: number): Date {
  return getLastSundayOfSeptember(fiscalYear - 1);
}

/**
 * Calculates the start and end dates for a specific fiscal month.
 * 
 * @param fiscalYear - The fiscal year (e.g., 2025)
 * @param fiscalMonth - The fiscal month (1-12, where 1 = October)
 */
function getFiscalMonthDates(fiscalYear: number, fiscalMonth: number): { start: Date; end: Date } {
  const fyStart = getFiscalYearStart(fiscalYear);
  
  // Calculate weeks offset from fiscal year start
  let weeksOffset = 0;
  for (let i = 0; i < fiscalMonth - 1; i++) {
    weeksOffset += WEEKS_PER_FISCAL_MONTH[i];
  }
  
  const start = new Date(fyStart);
  start.setDate(start.getDate() + weeksOffset * 7);
  
  const weeksInMonth = WEEKS_PER_FISCAL_MONTH[fiscalMonth - 1];
  const end = new Date(start);
  end.setDate(end.getDate() + weeksInMonth * 7 - 1);
  
  return { start, end };
}

/**
 * Converts a fiscal month (1-12) to a calendar month name.
 * Fiscal month 1 = October, Fiscal month 12 = September
 */
function fiscalMonthToCalendarMonth(fiscalMonth: number): number {
  // Fiscal 1 = October (9), Fiscal 2 = November (10), ..., Fiscal 12 = September (8)
  return (fiscalMonth + 8) % 12;
}

/**
 * Formats a date as "Mon DD" (e.g., "Nov 25")
 */
function formatShortDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Creates a FiscalMonth object for a given fiscal year and month.
 */
export function createFiscalMonth(fiscalYear: number, fiscalMonth: number): FiscalMonth {
  const { start, end } = getFiscalMonthDates(fiscalYear, fiscalMonth);
  const calendarMonth = fiscalMonthToCalendarMonth(fiscalMonth);
  const monthName = MONTH_NAMES[calendarMonth];
  
  // The calendar year for display purposes
  // Fiscal months 1-3 (Oct-Dec) belong to the previous calendar year
  const displayYear = fiscalMonth <= 3 ? fiscalYear - 1 : fiscalYear;
  
  // Format: YYYY-MM for the API (using the end date's month)
  const reportMonth = (end.getMonth() + 1).toString().padStart(2, "0");
  const reportYear = end.getFullYear();
  
  return {
    year: fiscalYear,
    month: fiscalMonth,
    startDate: start,
    endDate: end,
    displayName: `${monthName} ${displayYear} (${formatShortDate(start)} - ${formatShortDate(end)})`,
    reportDate: `${reportYear}-${reportMonth}`,
  };
}

/**
 * Gets the current fiscal year and month based on today's date.
 */
export function getCurrentFiscalPeriod(): { year: number; month: number } {
  const today = new Date();
  const currentCalendarYear = today.getFullYear();
  
  // Check fiscal years around the current calendar year
  for (const fiscalYear of [currentCalendarYear + 1, currentCalendarYear]) {
    for (let fiscalMonth = 12; fiscalMonth >= 1; fiscalMonth--) {
      const { start, end } = getFiscalMonthDates(fiscalYear, fiscalMonth);
      if (today >= start && today <= end) {
        return { year: fiscalYear, month: fiscalMonth };
      }
    }
  }
  
  // Fallback: return current calendar approximation
  const calendarMonth = today.getMonth();
  // Convert calendar month to fiscal month
  // Oct=1, Nov=2, Dec=3, Jan=4, Feb=5, Mar=6, Apr=7, May=8, Jun=9, Jul=10, Aug=11, Sep=12
  const fiscalMonth = calendarMonth >= 9 ? calendarMonth - 8 : calendarMonth + 4;
  const fiscalYear = calendarMonth >= 9 ? currentCalendarYear + 1 : currentCalendarYear;
  
  return { year: fiscalYear, month: fiscalMonth };
}

/**
 * Generates a list of fiscal months for selection, going back a specified number of months.
 * Returns most recent first.
 */
export function getRecentFiscalMonths(count: number = 12): FiscalMonth[] {
  const current = getCurrentFiscalPeriod();
  const months: FiscalMonth[] = [];
  
  let fiscalYear = current.year;
  let fiscalMonth = current.month;
  
  // Go back one month since current month is likely incomplete
  fiscalMonth--;
  if (fiscalMonth < 1) {
    fiscalMonth = 12;
    fiscalYear--;
  }
  
  for (let i = 0; i < count; i++) {
    months.push(createFiscalMonth(fiscalYear, fiscalMonth));
    
    fiscalMonth--;
    if (fiscalMonth < 1) {
      fiscalMonth = 12;
      fiscalYear--;
    }
  }
  
  return months;
}

/**
 * Gets the cache filename for a fiscal month.
 */
export function getCacheFilename(fiscalMonth: FiscalMonth): string {
  return `FY${fiscalMonth.year}-M${fiscalMonth.month.toString().padStart(2, "0")}.tsv`;
}
