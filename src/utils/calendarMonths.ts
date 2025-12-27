/**
 * Calendar month utilities with fiscal month conversion.
 * 
 * Apple's Financial Reports API uses fiscal month numbering:
 * - Fiscal Month 1 = October
 * - Fiscal Month 2 = November
 * - Fiscal Month 3 = December
 * - Fiscal Month 4 = January
 * - Fiscal Month 5 = February
 * - Fiscal Month 6 = March
 * - Fiscal Month 7 = April
 * - Fiscal Month 8 = May
 * - Fiscal Month 9 = June
 * - Fiscal Month 10 = July
 * - Fiscal Month 11 = August
 * - Fiscal Month 12 = September
 * 
 * When requesting a report, the API expects YYYY-MM where MM is the FISCAL month.
 */

export interface CalendarMonth {
  year: number;
  month: number; // 1-12 (calendar month)
  displayName: string; // e.g., "August 2025"
  reportDate: string; // Format: YYYY-MM for API calls (fiscal format)
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Converts a calendar month to Apple's fiscal month.
 * 
 * Calendar Month -> Fiscal Month
 * October (10)   -> 1
 * November (11)  -> 2
 * December (12)  -> 3
 * January (1)    -> 4
 * February (2)   -> 5
 * March (3)      -> 6
 * April (4)      -> 7
 * May (5)        -> 8
 * June (6)       -> 9
 * July (7)       -> 10
 * August (8)     -> 11
 * September (9)  -> 12
 */
function calendarToFiscalMonth(calendarMonth: number): number {
  // October (10) -> 1, November (11) -> 2, December (12) -> 3
  // January (1) -> 4, ..., September (9) -> 12
  if (calendarMonth >= 10) {
    return calendarMonth - 9; // Oct=1, Nov=2, Dec=3
  } else {
    return calendarMonth + 3; // Jan=4, Feb=5, ..., Sep=12
  }
}

/**
 * Gets the fiscal year for a given calendar year and month.
 * Fiscal year starts in October, so Oct-Dec belong to the NEXT fiscal year.
 */
function getFiscalYear(calendarYear: number, calendarMonth: number): number {
  if (calendarMonth >= 10) {
    return calendarYear + 1; // Oct-Dec 2024 -> FY 2025
  } else {
    return calendarYear; // Jan-Sep 2025 -> FY 2025
  }
}

/**
 * Creates a CalendarMonth object for a given year and month.
 */
export function createCalendarMonth(year: number, month: number): CalendarMonth {
  const monthName = MONTH_NAMES[month - 1];
  
  // Convert to fiscal month format for API
  const fiscalMonth = calendarToFiscalMonth(month);
  const fiscalYear = getFiscalYear(year, month);
  const reportMonth = fiscalMonth.toString().padStart(2, "0");
  
  return {
    year,
    month,
    displayName: `${monthName} ${year}`,
    reportDate: `${fiscalYear}-${reportMonth}`,
  };
}

/**
 * Generates a list of recent calendar months for selection.
 * Returns most recent completed month first.
 */
export function getRecentCalendarMonths(count: number = 12): CalendarMonth[] {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed, so this is the previous month
  
  // If we're in the first few days of the month, go back one more
  // (reports might not be ready yet)
  if (now.getDate() < 10) {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  
  const months: CalendarMonth[] = [];
  
  for (let i = 0; i < count; i++) {
    months.push(createCalendarMonth(year, month + 1)); // Convert to 1-indexed
    
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  
  return months;
}

/**
 * Gets the cache filename for a calendar month.
 */
export function getCacheFilename(calendarMonth: CalendarMonth): string {
  return `${calendarMonth.year}-${calendarMonth.month.toString().padStart(2, "0")}.tsv`;
}
