/**
 * Auth Service - Frontend
 * Manages authentication tokens and user session using HttpOnly cookies
 *
 * Security notes:
 * - Access tokens stored in HttpOnly cookies (cannot be accessed via JavaScript)
 * - Refresh tokens stored in HttpOnly cookies (Secure, SameSite=Strict)
 * - Admin data stored in sessionStorage (cleared on tab close, XSS mitigation)
 * - No tokens exposed to localStorage (XSS vulnerability prevention)
 * - Browser automatically sends cookies with each request (credentials: 'include')
 */

export class AuthService {
  private static readonly ADMIN_KEY = "admin_data";
  private static refreshTokenTimeout: ReturnType<typeof setTimeout> | null =
    null;
  private static isRefreshing = false; // Prevent concurrent refresh attempts

  /**
   * Save admin data to sessionStorage
   * SessionStorage is cleared when tab closes (more secure than localStorage)
   * Tokens remain in HttpOnly cookies (backend manages via Set-Cookie)
   */
  static saveAdmin(admin: any): void {
    sessionStorage.setItem(this.ADMIN_KEY, JSON.stringify(admin));
  }

  /**
   * Get admin data from sessionStorage
   * Returns null if no admin data (user not logged in)
   */
  static getAdmin(): any {
    const adminData = sessionStorage.getItem(this.ADMIN_KEY);
    return adminData ? JSON.parse(adminData) : null;
  }

  /**
   * Check if user is authenticated
   * HttpOnly cookies are automatically sent by browser, so we just check admin data
   */
  static isAuthenticated(): boolean {
    return !!this.getAdmin();
  }

  /**
   * Restore session from refresh token cookie when sessionStorage is empty.
   * This allows users to reopen the app without logging in again while the
   * refresh token is still valid.
   */
  static async restoreSession(): Promise<boolean> {
    if (this.isRefreshing) {
      return false;
    }

    try {
      this.isRefreshing = true;

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      const admin = data.data?.admin;
      const expiresIn = data.data?.expires_in;

      if (!admin || !expiresIn) {
        this.clearAuth();
        return false;
      }

      this.saveAdmin(admin);
      this.scheduleTokenRefresh(expiresIn);

      return true;
    } catch (error) {
      console.error("Failed to restore session:", error);
      this.clearAuth();
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Clear all auth data (admin info + auth state)
   * HttpOnly cookies are cleared by backend via Set-Cookie with maxAge=0
   */
  static clearAuth(): void {
    sessionStorage.removeItem(this.ADMIN_KEY);
    this.isRefreshing = false; // Reset refresh flag

    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }
  }

  /**
   * Refresh access token
   * Backend will set new access_token in HttpOnly cookie automatically
   * We only need to call the endpoint; browser handles cookie management
   */
  static async refreshAccessToken(): Promise<boolean> {
    // Prevent concurrent refresh attempts
    if (this.isRefreshing) {
      return false;
    }

    try {
      this.isRefreshing = true;

      // Call refresh endpoint - backend will set new access_token cookie
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies with request
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      const expiresIn = data.data?.expires_in;

      if (!expiresIn) {
        this.clearAuth();
        return false;
      }

      // Schedule next refresh (before expiry)
      this.scheduleTokenRefresh(expiresIn);

      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      this.clearAuth();
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Schedule automatic token refresh
   * Refresh 5 minutes before expiry
   */
  static scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    // Refresh 5 minutes (300 seconds) before expiry
    const refreshTime = Math.max((expiresIn - 300) * 1000, 0);

    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshAccessToken();
    }, refreshTime);
  }

  /**
   * Make authenticated API request
   * Browser automatically includes HttpOnly cookies via credentials: 'include'
   * No need to manually add Authorization header
   */
  static async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    // Ensure credentials are included (for HttpOnly cookies)
    const fetchOptions: RequestInit = {
      ...options,
      credentials: "include",
    };

    let response = await fetch(url, fetchOptions);

    // If 401 and not already refreshing, try to refresh token once
    if (response.status === 401 && !this.isRefreshing) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry request after token refresh
        response = await fetch(url, fetchOptions);
      }
    }

    return response;
  }
}
