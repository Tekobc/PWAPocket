/**
 * Date and Timezone Utilities for Pocket Manager
 * Dates in DB are civil dates (DATE 'YYYY-MM-DD').
 * All comparisons are made relative to the operator's configured time zone.
 */

export const DEFAULT_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Argentina/Buenos_Aires';

/**
 * Returns today's civil date string YYYY-MM-DD in the target time zone
 */
export function getTodayString(timeZone: string = DEFAULT_TIME_ZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // en-CA produces YYYY-MM-DD
}

/**
 * Returns tomorrow's civil date string YYYY-MM-DD in the target time zone
 */
export function getTomorrowString(timeZone: string = DEFAULT_TIME_ZONE): string {
  return addDaysToDateString(getTodayString(timeZone), 1);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Checks if a civil date string is in the past compared to today's date
 */
export function isOverdue(scheduledDate: string, todayStr: string): boolean {
  return scheduledDate < todayStr;
}

/**
 * Formats a civil date string (YYYY-MM-DD) for friendly UI display
 * e.g., "Miércoles, 22 de Octubre"
 */
export function formatFriendlyDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Formats short date e.g. "Lun 20/10"
 */
export function formatShortDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}
