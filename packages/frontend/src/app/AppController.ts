import { AuthService } from "../services/auth";
import { LoginPageComponent } from "../components/auth/LoginPage";
import { AppPageManager } from "./AppPageManager";

export class AppController {
  private pageManager = new AppPageManager({
    onLogout: () => this.handleLogout(),
  });
  private isAuthenticated = false;

  async start(): Promise<void> {
    this.isAuthenticated = AuthService.isAuthenticated();

    if (!this.isAuthenticated) {
      this.isAuthenticated = await AuthService.restoreSession();
    }

    if (!this.isAuthenticated) {
      this.showLoginPage();
      return;
    }

    try {
      await this.pageManager.initializeMainApp(
        this.pageManager.getSavedPage() || "home",
      );
    } catch (error) {
      console.error("Failed to initialize app:", error);
      this.handleAuthError("Gagal menginisialisasi aplikasi");
    }
  }

  destroy(): void {
    this.pageManager.destroy();
  }

  private showLoginPage(): void {
    const app = document.getElementById("app");
    if (!app) return;

    app.innerHTML = `<div id="login-container"></div>`;

    const loginComponent = new LoginPageComponent("login-container", (data) =>
      this.handleLoginSuccess(data),
    );
    loginComponent.init();
  }

  private async handleLoginSuccess(data: any): Promise<void> {
    AuthService.saveAdmin(data.admin);

    const expiresIn = data.expires_in || 43200;
    AuthService.scheduleTokenRefresh(expiresIn);

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      this.isAuthenticated = true;
      this.pageManager.setCurrentPage("home");
      await this.pageManager.initializeMainApp("home");
    } catch (error) {
      console.error("Failed to initialize main app after login:", error);
      this.handleAuthError("Gagal menginisialisasi aplikasi");
    }
  }

  private handleLogout(): void {
    this.pageManager.clearSavedPage();
    AuthService.clearAuth();
    this.isAuthenticated = false;
    this.showLoginPage();
  }

  private handleAuthError(message: string): void {
    this.pageManager.destroy();
    AuthService.clearAuth();
    this.isAuthenticated = false;

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
}
