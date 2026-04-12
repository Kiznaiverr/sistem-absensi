/**
 * Timezone Service - Frontend timezone utilities
 * All times in Asia/Jakarta timezone
 */

export class TimezoneService {
  private static readonly TIMEZONE = "Asia/Jakarta";

  /**
   * Get current time in Asia/Jakarta timezone
   */
  static getCurrentTime(): Date {
    // Convert UTC to Jakarta time
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const dateObj: any = {};

    for (const part of parts) {
      dateObj[part.type] = part.value;
    }

    return new Date(
      `${dateObj.year}-${dateObj.month}-${dateObj.day}T${dateObj.hour}:${dateObj.minute}:${dateObj.second}`,
    );
  }

  /**
   * Get current date in YYYY-MM-DD format (Jakarta time)
   */
  static getCurrentDateString(): string {
    const now = this.getCurrentTime();
    return now.toISOString().split("T")[0];
  }

  /**
   * Get current time in HH:mm format (Jakarta time)
   */
  static getCurrentTimeString(): string {
    const now = this.getCurrentTime();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * Get current hour (0-23)
   */
  static getCurrentHour(): number {
    return this.getCurrentTime().getHours();
  }

  /**
   * Get current minute (0-59)
   */
  static getCurrentMinute(): number {
    return this.getCurrentTime().getMinutes();
  }

  /**
   * Get current month and year
   */
  static getCurrentMonthYear(): { month: number; year: number } {
    const now = this.getCurrentTime();
    return {
      month: now.getMonth(),
      year: now.getFullYear(),
    };
  }

  /**
   * Detect current shift based on time
   * Siang: 13:00 - 16:00
   * Malam: 18:00 - 21:00
   */
  static detectShift(): "siang" | "malam" | null {
    const hour = this.getCurrentHour();
    const minute = this.getCurrentMinute();
    const currentTime = hour * 60 + minute;

    const siangStart = 13 * 60; // 13:00
    const siangEnd = 16 * 60; // 16:00
    const malamStart = 18 * 60; // 18:00
    const malamEnd = 21 * 60; // 21:00

    if (currentTime >= siangStart && currentTime < siangEnd) {
      return "siang";
    }
    if (currentTime >= malamStart && currentTime < malamEnd) {
      return "malam";
    }

    return null;
  }

  /**
   * Check if a shift is currently active
   */
  static isShiftActive(shift: "siang" | "malam"): boolean {
    return this.detectShift() === shift;
  }

  /**
   * Get shift time range
   */
  static getShiftTimeRange(shift: "siang" | "malam"): {
    start: string;
    end: string;
  } {
    return shift === "siang"
      ? { start: "13:00", end: "16:00" }
      : { start: "18:00", end: "21:00" };
  }

  /**
   * Format timestamp to HH:mm
   */
  static formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * Format timestamp to YYYY-MM-DD
   */
  static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split("T")[0];
  }

  /**
   * Format full datetime
   */
  static formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split("T")[0];
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${dateStr} ${hours}:${minutes}`;
  }

  /**
   * Get month name in Indonesian
   */
  static getMonthName(month: number): string {
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return months[month] || "Invalid";
  }

  /**
   * Get day name in Indonesian
   */
  static getDayName(day: number): string {
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    return days[day] || "Invalid";
  }

  /**
   * Get time until shift ends (in minutes)
   * Returns null if no shift is active
   */
  static getTimeUntilShiftEnd(): number | null {
    const shift = this.detectShift();
    if (!shift) return null;

    const hour = this.getCurrentHour();
    const minute = this.getCurrentMinute();
    const currentTime = hour * 60 + minute;

    if (shift === "siang") {
      const endTime = 16 * 60; // 16:00
      return Math.max(0, endTime - currentTime);
    } else {
      const endTime = 21 * 60; // 21:00
      return Math.max(0, endTime - currentTime);
    }
  }
}
