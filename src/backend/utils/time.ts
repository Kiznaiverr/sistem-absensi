import { Shift } from "../../shared/types";
import { timeConfig } from "../config/time";
import { utcToZonedTime, format } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

/**
 * Parse time string in format "HH:mm" to minutes
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time in minutes (in Jakarta timezone)
 */
export function getCurrentTimeInMinutes(): number {
  const now = new Date();
  const jakartaTime = utcToZonedTime(now, TIMEZONE);
  return jakartaTime.getHours() * 60 + jakartaTime.getMinutes();
}

/**
 * Detect shift based on current time
 * Returns "siang" or "malam" or null if outside hours
 */
export function detectShift(): Shift | null {
  const currentMinutes = getCurrentTimeInMinutes();

  const siangStart = timeToMinutes(timeConfig.shifts.siang.start);
  const siangEnd = timeToMinutes(timeConfig.shifts.siang.end);
  const malamStart = timeToMinutes(timeConfig.shifts.malam.start);
  const malamEnd = timeToMinutes(timeConfig.shifts.malam.end);

  if (currentMinutes >= siangStart && currentMinutes < siangEnd) {
    return "siang";
  }
  if (currentMinutes >= malamStart && currentMinutes < malamEnd) {
    return "malam";
  }

  return null;
}

/**
 * Check if a shift is currently within operating hours
 */
export function isShiftActive(shift: Shift): boolean {
  const currentMinutes = getCurrentTimeInMinutes();

  const config = timeConfig.shifts[shift];
  const start = timeToMinutes(config.start);
  const end = timeToMinutes(config.end);

  return currentMinutes >= start && currentMinutes < end;
}

/**
 * Get time range for a shift
 */
export function getShiftTimeRange(shift: Shift): {
  start: string;
  end: string;
} {
  return timeConfig.shifts[shift];
}

/**
 * Format date to YYYY-MM-DD (in Jakarta timezone)
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const jakartaTime = utcToZonedTime(now, TIMEZONE);
  return format(jakartaTime, "yyyy-MM-dd");
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const jakartaTime = utcToZonedTime(date, TIMEZONE);
  return format(jakartaTime, "yyyy-MM-dd");
}

/**
 * Format time to HH:mm
 */
export function formatTime(date: Date): string {
  const jakartaTime = utcToZonedTime(date, TIMEZONE);
  return format(jakartaTime, "HH:mm");
}

/**
 * Get current month and year
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  const jakartaTime = utcToZonedTime(now, TIMEZONE);
  return {
    month: jakartaTime.getMonth(),
    year: jakartaTime.getFullYear(),
  };
}

/**
 * Get first and last day of a month
 */
export function getMonthRange(
  month: number,
  year: number,
): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}
