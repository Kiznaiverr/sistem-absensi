import { ApiService } from "../services/api";
import { FrontendCacheService } from "../services/cache";
import { TimezoneService } from "../services/timezone";
import {
  RFIDFormComponent,
  renderHeader,
  initializeHeader,
  renderAttendanceStats,
  renderLayout,
  SantriPage,
} from "../components";
import { ExportPageComponent } from "../components/export/ExportPage";
import type { HeaderComponent } from "../components/layout/Header";

export type AppPage = "home" | "export" | "santri";

const CURRENT_PAGE_KEY = "current_page";

export class AppPageManager {
  private readonly onLogout: () => void;
  private rfidFormComponent: RFIDFormComponent | null = null;
  private headerComponent: HeaderComponent | null = null;
  private exportPageComponent: ExportPageComponent | null = null;
  private santriPage: SantriPage | null = null;
  private statsUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private currentPage: AppPage = "home";

  constructor(options: { onLogout: () => void }) {
    this.onLogout = options.onLogout;
  }

  getSavedPage(): AppPage | null {
    const savedPage = sessionStorage.getItem(CURRENT_PAGE_KEY);
    if (
      savedPage === "home" ||
      savedPage === "export" ||
      savedPage === "santri"
    ) {
      return savedPage;
    }
    return null;
  }

  setCurrentPage(page: AppPage): void {
    this.currentPage = page;
    sessionStorage.setItem(CURRENT_PAGE_KEY, page);
  }

  clearSavedPage(): void {
    sessionStorage.removeItem(CURRENT_PAGE_KEY);
  }

  async initializeMainApp(initialPage: AppPage = "home"): Promise<void> {
    this.currentPage = initialPage;
    await FrontendCacheService.init();
    await ApiService.refreshAttendanceTodayCache();
    await ApiService.getClasses();
    await ApiService.getAllSantri(undefined, { bypassCache: true });
    this.renderApp();
  }

  renderApp(): void {
    const app = document.getElementById("app");
    if (!app) return;

    this.destroyHeaderComponent();
    this.unmountCurrentPage();

    const headerHtml = renderHeader({ currentPage: this.currentPage });

    let pageContent = "";
    if (this.currentPage === "home") {
      pageContent = this.renderHomePage();
    } else if (this.currentPage === "export") {
      pageContent = `<div id="export-page-container" style="min-height: 100vh;"></div>`;
    } else if (this.currentPage === "santri") {
      pageContent = `<div id="santri-page-container" style="min-height: 100vh;"></div>`;
    }

    app.innerHTML = headerHtml + pageContent;

    this.headerComponent = initializeHeader({
      currentPage: this.currentPage,
      onHomeClick: () => {
        this.setCurrentPage("home");
        this.renderApp();
      },
      onExportClick: () => {
        this.setCurrentPage("export");
        this.renderApp();
      },
      onSantriClick: () => {
        this.setCurrentPage("santri");
        this.renderApp();
      },
      onLogoutClick: () => this.onLogout(),
    });

    if (this.currentPage === "home") {
      this.initializeSidebar();
      this.mountHomeFeatures();
    } else if (this.currentPage === "export") {
      this.mountExportPage();
    } else if (this.currentPage === "santri") {
      this.mountSantriPage();
    }
  }

  destroy(): void {
    this.unmountCurrentPage();
    this.destroyHeaderComponent();
  }

  private mountHomeFeatures(): void {
    this.destroyRfidFormComponent();

    this.rfidFormComponent = new RFIDFormComponent({
      containerId: "rfid-form-container",
      onSuccess: (record) => this.handleAttendanceSuccess(record),
      onError: (error) => this.handleAttendanceError(error),
    });
    this.rfidFormComponent.init();

    void this.updateStats();
    this.startStatsUpdates();
  }

  private mountExportPage(): void {
    this.exportPageComponent = new ExportPageComponent("export-page-container");
    this.exportPageComponent.init();
  }

  private mountSantriPage(): void {
    this.santriPage = new SantriPage("santri-page-container");
    this.santriPage.init();
  }

  private unmountCurrentPage(): void {
    this.destroyRfidFormComponent();
    this.destroyHeaderComponent();
    this.stopStatsUpdates();
  }

  private destroyRfidFormComponent(): void {
    if (this.rfidFormComponent) {
      this.rfidFormComponent.destroy();
      this.rfidFormComponent = null;
    }
  }

  private destroyHeaderComponent(): void {
    if (this.headerComponent) {
      this.headerComponent.destroy();
      this.headerComponent = null;
    }
  }

  private renderHomePage(): string {
    const stats = renderAttendanceStats();
    const sidebar = `<div id="sidebar-placeholder"></div>`;

    const mainContent = `
      <div class="bg-white rounded-lg shadow-md p-5 border border-cream-200/50 animate-slideUp">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Form Input Absensi</h2>
        <div id="rfid-form-container"></div>
      </div>
    `;

    return renderLayout({
      stats,
      mainContent,
      sidebar,
    });
  }

  private setupPeriodicUIUpdates(): void {
    this.statsUpdateInterval = setInterval(() => {
      void this.updateStats();
    }, 5000);
  }

  private startStatsUpdates(): void {
    this.stopStatsUpdates();
    this.setupPeriodicUIUpdates();
  }

  private stopStatsUpdates(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  }

  private async updateStats(): Promise<void> {
    let summary = FrontendCacheService.getTodaySummary();

    try {
      summary = await ApiService.getTodaySummary();
    } catch (error) {
      // Fallback to local cache if the endpoint is temporarily unavailable.
      console.warn(
        "Failed to fetch today summary from API, using cache",
        error,
      );
    }

    const siangEl = document.getElementById("stat-siang");
    const malamEl = document.getElementById("stat-malam");
    const totalEl = document.getElementById("stat-total");

    if (siangEl) siangEl.textContent = summary.siang_count.toString();
    if (malamEl) malamEl.textContent = summary.malam_count.toString();
    if (totalEl) totalEl.textContent = summary.total_count.toString();
  }

  private initializeSidebar(): void {
    const placeholder = document.getElementById("sidebar-placeholder");
    if (!placeholder) return;

    this.renderSidebarContent(placeholder);
  }

  private renderSidebarContent(targetElement: HTMLElement): void {
    const records = FrontendCacheService.getTodayRecords();

    let content = `
      <div class="card-lg">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Absensi Terbaru</h2>
    `;

    if (records.length === 0) {
      content += `<p class="text-gray-500 text-center py-8">Belum ada data absensi</p>`;
    } else {
      const recentItems = records
        .reverse()
        .slice(0, 10)
        .map(
          (record) => `
            <div class="list-item animate-slideUp">
              <div>
                <p class="list-item-title">${record.name}</p>
                <p class="list-item-meta">${record.class_name} • 
                  <span class="font-semibold">
                    ${record.shift === "siang" ? "Siang" : "Malam"}
                  </span>
                </p>
              </div>
              <span class="badge badge-success">
                ${TimezoneService.formatTime(record.checked_in_at)}
              </span>
            </div>
          `,
        )
        .join("");

      content += `
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${recentItems}
        </div>
      `;
    }

    content += `</div>`;
    targetElement.innerHTML = content;
  }

  private handleAttendanceSuccess(_record?: any): void {
    void this.updateStats();
    this.initializeSidebar();
  }

  private handleAttendanceError(error: any): void {
    console.error("Attendance error:", error);
  }
}
