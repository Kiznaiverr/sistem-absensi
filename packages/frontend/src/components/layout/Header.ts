/**
 * Header Component
 * Displays app title, current time, day, and shift information
 */

import { TimezoneService } from "../../services/timezone";

export class HeaderComponent {
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize header with real-time updates
   */
  init(): void {
    this.render();
    this.setupRealtimeUpdates();
  }

  /**
   * Setup real-time clock updates (every second)
   */
  private setupRealtimeUpdates(): void {
    this.updateTime();
    this.updateInterval = setInterval(() => {
      this.updateTime();
    }, 1000);
  }

  /**
   * Update time display
   */
  private updateTime(): void {
    const timeEl = document.getElementById("header-time");
    if (timeEl) {
      timeEl.textContent = TimezoneService.getCurrentTimeString();
    }
  }

  /**
   * Get day name in Indonesian
   */
  private getDayName(): string {
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    return days[new Date().getDay()];
  }

  /**
   * Render initial header
   */
  render(): string {
    const currentTime = TimezoneService.getCurrentTimeString();
    const dayName = this.getDayName();
    const { month, year } = TimezoneService.getCurrentMonthYear();
    const monthName = TimezoneService.getMonthName(month);
    const currentShift = TimezoneService.detectShift();

    const shiftBadgeClass = currentShift
      ? currentShift === "siang"
        ? "badge-siang"
        : "badge-malam"
      : "badge-info";

    const shiftText = currentShift
      ? currentShift === "siang"
        ? "Siang (13:00-16:00)"
        : "Malam (18:00-21:00)"
      : "Diluar Jam Madrasah";

    return `
      <header class="bg-gradient-to-r from-peach-50 to-cream-50 rounded-lg shadow-lg p-6 border-2 border-peach-200 mb-4 animate-fadeIn">
        <div class="flex justify-between items-center gap-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">
              Absensi Santri
            </h1>
            <p class="text-gray-600 text-sm mt-1">Sistem Manajemen Kehadiran Madrasah Berbasis RFID</p>
          </div>
          <div class="text-right space-y-2">
            <div class="text-5xl font-bold text-peach-300 font-mono tracking-wider">
              <span id="header-time">${currentTime}</span>
            </div>
            <p class="text-base text-gray-700 font-semibold">
              ${dayName}, ${monthName} ${year}
            </p>
            <span class="${shiftBadgeClass}">
              ${shiftText}
            </span>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export function renderHeader(): string {
  return new HeaderComponent().render();
}

/**
 * Initialize header component with real-time updates
 */
export function initializeHeader(): HeaderComponent {
  const header = new HeaderComponent();
  header.init();
  return header;
}
