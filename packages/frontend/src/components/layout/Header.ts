/**
 * Unified Header Component with Navigation
 * Displays app title, time, navigation buttons, and controls
 */

import { TimezoneService } from "../../services/timezone";

export class HeaderComponent {
  private updateInterval: ReturnType<typeof setTimeout> | null = null;
  private currentPage: "home" | "export" | "santri" = "home";
  private onHomeClick: (() => void) | null = null;
  private onExportClick: (() => void) | null = null;
  private onSantriClick: (() => void) | null = null;
  private onLogoutClick: (() => void) | null = null;

  constructor(options?: {
    currentPage?: "home" | "export" | "santri";
    onHomeClick?: () => void;
    onExportClick?: () => void;
    onSantriClick?: () => void;
    onLogoutClick?: () => void;
  }) {
    this.currentPage = options?.currentPage || "home";
    this.onHomeClick = options?.onHomeClick || null;
    this.onExportClick = options?.onExportClick || null;
    this.onSantriClick = options?.onSantriClick || null;
    this.onLogoutClick = options?.onLogoutClick || null;
  }

  /**
   * Initialize header with real-time updates
   */
  init(): void {
    this.render();
    this.setupRealtimeUpdates();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for buttons
   */
  private setupEventListeners(): void {
    const homeBtn = document.getElementById("btn-nav-home");
    const exportBtn = document.getElementById("btn-nav-export");
    const santriBtn = document.getElementById("btn-nav-santri");
    const logoutBtn = document.getElementById("btn-logout");

    homeBtn?.addEventListener("click", () => {
      if (this.onHomeClick) this.onHomeClick();
    });

    exportBtn?.addEventListener("click", () => {
      if (this.onExportClick) this.onExportClick();
    });

    santriBtn?.addEventListener("click", () => {
      if (this.onSantriClick) this.onSantriClick();
    });

    logoutBtn?.addEventListener("click", () => {
      if (this.onLogoutClick) this.onLogoutClick();
    });
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
   * Render unified header with navigation and info
   */
  render(): string {
    const currentTime = TimezoneService.getCurrentTimeString();
    const dayName = this.getDayName();

    return `
      <header class="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div class="max-w-full px-6 py-3">
          <div class="flex justify-between items-center gap-4">
            <!-- Left: Title + Time Info (Compact) -->
            <div class="flex items-center gap-6 flex-1">
              <h1 class="text-lg font-bold text-gray-900 whitespace-nowrap">Absensi Santri</h1>
              
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span id="header-time" class="font-semibold text-gray-800">${currentTime}</span>
                <span>•</span>
                <span>${dayName}</span>
              </div>
            </div>

            <!-- Right: Navigation Buttons -->
            <div class="flex items-center gap-2">
              <button 
                id="btn-nav-home" 
                class="px-3 py-1.5 text-sm ${this.currentPage === "home" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} rounded-md font-medium transition-colors duration-200">
                Home
              </button>
              <button 
                id="btn-nav-export" 
                class="px-3 py-1.5 text-sm ${this.currentPage === "export" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} rounded-md font-medium transition-colors duration-200">
                Export
              </button>
              <button 
                id="btn-nav-santri" 
                class="px-3 py-1.5 text-sm ${this.currentPage === "santri" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} rounded-md font-medium transition-colors duration-200">
                Santri
              </button>
              <div class="w-px h-6 bg-gray-200"></div>
              <button 
                id="btn-logout" 
                class="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-medium transition-colors duration-200">
                Logout
              </button>
            </div>
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

export function renderHeader(options?: {
  currentPage?: "home" | "export" | "santri";
  onHomeClick?: () => void;
  onExportClick?: () => void;
  onSantriClick?: () => void;
  onLogoutClick?: () => void;
}): string {
  return new HeaderComponent(options).render();
}

/**
 * Initialize header component with real-time updates and event handlers
 */
export function initializeHeader(options?: {
  currentPage?: "home" | "export" | "santri";
  onHomeClick?: () => void;
  onExportClick?: () => void;
  onSantriClick?: () => void;
  onLogoutClick?: () => void;
}): HeaderComponent {
  const header = new HeaderComponent(options);
  header.init();
  return header;
}
