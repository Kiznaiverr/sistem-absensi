import "./styles/index.css";
import { AuthService } from "./services/auth";
import { FrontendCacheService } from "./services/cache";
import { ApiService } from "./services/api";
import { TimezoneService } from "./services/timezone";
import {
  RFIDFormComponent,
  renderHeader,
  initializeHeader,
  renderAttendanceStats,
  renderLayout,
  SantriPage,
} from "./components";
import { LoginPageComponent } from "./components/auth/LoginPage";
import { ExportPageComponent } from "./components/export/ExportPage";
import type { HeaderComponent } from "./components/layout/Header";

let rfidFormComponent: RFIDFormComponent | null = null;
let headerComponent: HeaderComponent | null = null;
let exportPageComponent: ExportPageComponent | null = null;
let santriPage: SantriPage | null = null;
let currentPage: "home" | "export" | "santri" = "home";
let isAuthenticated = false;
let statsUpdateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Setup global event listeners
 */
function setupGlobalEventListeners(): void {
  window.addEventListener("navigateToPage", (event: any) => {
    const page = event.detail?.page;
    if (page === "home" || page === "export" || page === "santri") {
      currentPage = page;
      renderApp();
    }
  });
}

/**
 * Main application initialization
 */
async function initializeApp() {
  // Check authentication status
  isAuthenticated = AuthService.isAuthenticated();

  // Setup global event listeners
  setupGlobalEventListeners();

  if (!isAuthenticated) {
    showLoginPage();
  } else {
    try {
      await initializeMainApp();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      handleAuthError("Gagal menginisialisasi aplikasi");
    }
  }
}

/**
 * Show login page
 */
function showLoginPage(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `<div id="login-container"></div>`;

  const loginComponent = new LoginPageComponent(
    "login-container",
    handleLoginSuccess,
  );
  loginComponent.init();
}

/**
 * Handle successful login
 * Backend sets HttpOnly cookies automatically, no need to save tokens
 * We only need to save admin data for UI display
 */
async function handleLoginSuccess(data: any): Promise<void> {
  // Save admin data (tokens are in HttpOnly cookies managed by backend)
  AuthService.saveAdmin(data.admin);

  // Get expires_in to schedule token refresh
  const expiresIn = data.expires_in || 43200; // 12 hours default
  AuthService.scheduleTokenRefresh(expiresIn);

  // Small delay for animation
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Initialize main app
  try {
    isAuthenticated = true;
    await initializeMainApp();
  } catch (error) {
    console.error("Failed to initialize main app after login:", error);
    handleAuthError("Gagal menginisialisasi aplikasi");
  }
}

/**
 * Initialize main application after authentication
 */
async function initializeMainApp(): Promise<void> {
  await FrontendCacheService.init();

  // Keep backend attendance cache in sync when page is refreshed.
  await ApiService.refreshAttendanceTodayCache();

  await ApiService.getClasses();

  // Preload santri cache from fresh source to avoid stale class-based backend cache.
  await ApiService.getAllSantri(undefined, { bypassCache: true });

  // Render UI
  renderApp();
}

/**
 * Create home-scoped components safely.
 * Always destroy old instances before creating new ones.
 */
function mountHomeFeatures(): void {
  destroyRfidFormComponent();

  rfidFormComponent = new RFIDFormComponent({
    containerId: "rfid-form-container",
    onSuccess: handleAttendanceSuccess,
    onError: handleAttendanceError,
  });
  rfidFormComponent.init();

  startStatsUpdates();
}

/**
 * Destroy home-scoped components/timers to prevent duplicate listeners.
 */
function unmountHomeFeatures(): void {
  destroyRfidFormComponent();
  stopStatsUpdates();
}

function destroyRfidFormComponent(): void {
  if (rfidFormComponent) {
    rfidFormComponent.destroy();
    rfidFormComponent = null;
  }
}

/**
 * Render the entire application UI
 */
function renderApp(): void {
  const app = document.getElementById("app");
  if (!app) return;

  // Prevent duplicated global listeners/timers across re-renders.
  unmountHomeFeatures();

  // Render unified header
  const headerHtml = renderHeader({
    currentPage,
  });

  // Render different pages based on currentPage
  let pageContent = "";

  if (currentPage === "home") {
    pageContent = renderHomePage();
  } else if (currentPage === "export") {
    pageContent = `<div id="export-page-container" style="min-height: 100vh;"></div>`;
  } else if (currentPage === "santri") {
    pageContent = `<div id="santri-page-container" style="min-height: 100vh;"></div>`;
  }

  app.innerHTML = headerHtml + pageContent;

  // Initialize header with navigation callbacks (AFTER rendering content)
  headerComponent = initializeHeader({
    currentPage,
    onHomeClick: () => {
      currentPage = "home";
      renderApp();
    },
    onExportClick: () => {
      currentPage = "export";
      renderApp();
      // Initialize export page after rendering
      setTimeout(() => {
        exportPageComponent = new ExportPageComponent("export-page-container");
        exportPageComponent.init();
      }, 0);
    },
    onSantriClick: () => {
      currentPage = "santri";
      renderApp();
      // Initialize santri page after rendering
      setTimeout(() => {
        santriPage = new SantriPage("santri-page-container");
        santriPage.init();
      }, 0);
    },
    onLogoutClick: () => {
      handleLogout();
    },
  });

  // Setup based on current page
  if (currentPage === "home") {
    // Initialize sidebar content
    initializeSidebar();

    // Initialize home-specific features
    mountHomeFeatures();
  }
}

/**
 * Handle logout
 */
function handleLogout(): void {
  unmountHomeFeatures();
  AuthService.clearAuth();
  isAuthenticated = false;
  currentPage = "home";

  // Redirect to login
  showLoginPage();
}

/**
 * Handle authentication error and redirect to login
 */
function handleAuthError(message: string): void {
  unmountHomeFeatures();
  AuthService.clearAuth();
  isAuthenticated = false;

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
 * Render home page content (without header - unified header handled in renderApp)
 */
function renderHomePage(): string {
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

  // Create layout without header (unified header in renderApp)
  return renderLayout({
    stats,
    mainContent,
    sidebar,
  });
}

/**
 * Setup periodic UI updates (every 5 seconds)
 */
function setupPeriodicUpdates(): void {
  statsUpdateInterval = setInterval(() => {
    updateStats();
  }, 5000);
}

function startStatsUpdates(): void {
  stopStatsUpdates();
  setupPeriodicUpdates();
}

function stopStatsUpdates(): void {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval);
    statsUpdateInterval = null;
  }
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
 * Cleanup component on page unload
 */
window.addEventListener("beforeunload", () => {
  unmountHomeFeatures();
  if (headerComponent) {
    headerComponent.destroy();
  }
});

// Initialize application on page load
initializeApp();
