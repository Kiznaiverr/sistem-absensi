import "./styles/index.css";
import { FrontendCacheService } from "./services/cache";
import { ApiService } from "./services/api";
import { TimezoneService } from "./services/timezone";
import {
  RFIDFormComponent,
  renderHeader,
  initializeHeader,
  renderAttendanceStats,
  renderLayout,
} from "./components";
import { ExportPageComponent } from "./components/export/ExportPage";
import type { HeaderComponent } from "./components/layout/Header";

let rfidFormComponent: RFIDFormComponent | null = null;
let headerComponent: HeaderComponent | null = null;
let exportPageComponent: ExportPageComponent | null = null;
let currentPage: "home" | "export" = "home";

/**
 * Main application initialization
 */
async function initializeApp() {
  try {
    await FrontendCacheService.init();

    const classes = await ApiService.getClasses();

    // Load santri for all classes
    const allSantri: any[] = [];
    for (const classItem of classes) {
      const santri = await ApiService.getSantriByClass(classItem.id);
      allSantri.push(...(santri as any));
    }

    FrontendCacheService.setSantri(allSantri);

    // Render UI
    renderApp();

    // Initialize RFID form
    rfidFormComponent = new RFIDFormComponent({
      containerId: "rfid-form-container",
      onSuccess: handleAttendanceSuccess,
      onError: handleAttendanceError,
    });
    rfidFormComponent.init();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showError("Gagal menginisialisasi aplikasi");
  }
}

/**
 * Render the entire application UI
 */
function renderApp(): void {
  const app = document.getElementById("app");
  if (!app) return;

  // Build top navigation
  const navigation = `
    <div class="bg-white border-b border-cream-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        <h1 class="text-xl font-bold text-gray-900 flex-1">Absensi Santri</h1>
        <div class="flex gap-2">
          <button id="nav-home" class="px-4 py-2 ${currentPage === "home" ? "bg-peach-500 text-white" : "bg-gray-100 text-gray-700"} rounded-md font-medium transition hover:opacity-90">
            Home
          </button>
          <button id="nav-export" class="px-4 py-2 ${currentPage === "export" ? "bg-peach-500 text-white" : "bg-gray-100 text-gray-700"} rounded-md font-medium transition hover:opacity-90">
            Export Data
          </button>
        </div>
      </div>
    </div>
  `;

  // Render different pages based on currentPage
  let pageContent = "";

  if (currentPage === "home") {
    pageContent = renderHomePage();
  } else if (currentPage === "export") {
    pageContent = `<div id="export-page-container" style="min-height: 100vh;"></div>`;
  }

  app.innerHTML = navigation + pageContent;

  // Setup navigation listeners
  document.getElementById("nav-home")?.addEventListener("click", () => {
    currentPage = "home";
    renderApp();
  });

  document.getElementById("nav-export")?.addEventListener("click", () => {
    currentPage = "export";
    renderApp();
    // Initialize export page after rendering
    setTimeout(() => {
      exportPageComponent = new ExportPageComponent("export-page-container");
      exportPageComponent.init();
    }, 0);
  });

  // Setup based on current page
  if (currentPage === "home") {
    // Setup periodic updates
    setupPeriodicUpdates();

    // Initialize sidebar content
    initializeSidebar();

    // Initialize header with real-time updates
    headerComponent = initializeHeader();

    // Initialize RFID form
    rfidFormComponent = new RFIDFormComponent({
      containerId: "rfid-form-container",
      onSuccess: handleAttendanceSuccess,
      onError: handleAttendanceError,
    });
    rfidFormComponent.init();
  }
}

/**
 * Render home page content
 */
function renderHomePage(): string {
  const headerHtml = renderHeader();
  const stats = renderAttendanceStats();

  // Sidebar placeholder (will be populated by initializeSidebar)
  const sidebar = `<div id="sidebar-placeholder"></div>`;

  // Main RFID Form content
  const mainContent = `
    <div class="bg-white rounded-lg shadow-md p-5 border border-cream-200/50 animate-slideUp">
      <h2 class="text-lg font-bold text-gray-900 mb-4">Form Input Absensi</h2>
      <div id="rfid-form-container"></div>
    </div>
  `;

  // Create layout with header included
  return renderLayout({
    header: headerHtml,
    stats,
    mainContent,
    sidebar,
  });
}

/**
 * Setup periodic UI updates (every 5 seconds)
 */
function setupPeriodicUpdates(): void {
  setInterval(() => {
    updateStats();
  }, 5000);
}

/**
 * Update stat cards with latest data
 */
function updateStats(): void {
  const summary = FrontendCacheService.getTodaySummary();
  const siangEl = document.getElementById("stat-siang");
  const malamEl = document.getElementById("stat-malam");
  const totalEl = document.getElementById("stat-total");

  if (siangEl) siangEl.textContent = summary.siang_count.toString();
  if (malamEl) malamEl.textContent = summary.malam_count.toString();
  if (totalEl) totalEl.textContent = summary.total_count.toString();
}

/**
 * Initialize sidebar with initial data
 */
function initializeSidebar(): void {
  const placeholder = document.getElementById("sidebar-placeholder");
  if (!placeholder) return;

  renderSidebarContent(placeholder);
}

/**
 * Render sidebar content (used for both initial and updates)
 */
function renderSidebarContent(targetElement: HTMLElement): void {
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

/**
 * Update sidebar with latest attendance records
 */
function updateSidebar(): void {
  const placeholder = document.getElementById("sidebar-placeholder");
  if (!placeholder) {
    console.warn("Sidebar placeholder not found!");
    return;
  }

  renderSidebarContent(placeholder);
}

/**
 * Handle attendance success callback
 */
function handleAttendanceSuccess(_record?: any): void {
  updateStats();
  updateSidebar();
}

/**
 * Handle attendance error callback
 */
function handleAttendanceError(error: any): void {
  console.error("Attendance error:", error);
}

/**
 * Display error message to user
 */
function showError(message: string): void {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <div class="app-container flex items-center justify-center p-4">
        <div class="card-lg bg-red-50 border-red-300 max-w-md text-center">
          <p class="text-2xl mb-4">ERROR</p>
          <h1 class="text-2xl font-bold text-red-700 mb-2">Aplikasi Error</h1>
          <p class="text-red-600">${message}</p>
          <button 
            class="btn btn-primary mt-6"
            onclick="location.reload()">
            Reload Aplikasi
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Cleanup component on page unload
 */
window.addEventListener("beforeunload", () => {
  if (rfidFormComponent) {
    rfidFormComponent.destroy();
  }
  if (headerComponent) {
    headerComponent.destroy();
  }
});

// Initialize application on page load
initializeApp();
