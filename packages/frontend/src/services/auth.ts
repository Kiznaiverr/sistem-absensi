/**
 * Auth Service - Frontend
 * Manages authentication tokens and user session
 */

export class AuthService {
  private static readonly TOKEN_KEY = "access_token";
  private static readonly REFRESH_TOKEN_KEY = "refresh_token";
  private static readonly ADMIN_KEY = "admin_data";
  private static refreshTokenTimeout: ReturnType<typeof setTimeout> | null =
    null;

  /**
   * Save tokens to localStorage
   */
  static saveTokens(
    accessToken: string,
    refreshToken: string,
    admin: any,
  ): void {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(admin));
  }

  /**
   * Get access token from localStorage
   */
  static getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get refresh token from localStorage
   */
  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Get admin data from localStorage
   */
  static getAdmin(): any {
    const adminData = localStorage.getItem(this.ADMIN_KEY);
    return adminData ? JSON.parse(adminData) : null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Clear all auth data
   */
  static clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.ADMIN_KEY);

    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        this.clearAuth();
        return null;
      }

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        this.clearAuth();
        return null;
      }

      const data = await response.json();
      const newAccessToken = data.data.access_token;

      // Save new token
      localStorage.setItem(this.TOKEN_KEY, newAccessToken);

      // Schedule next refresh (before expiry)
      this.scheduleTokenRefresh(data.data.expires_in);

      return newAccessToken;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      this.clearAuth();
      return null;
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
   */
  static async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = this.getAccessToken();

    if (!token) {
      throw new Error("No authentication token");
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(url, { ...options, headers });

    // If 401, try to refresh token
    if (response.status === 401) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  }
}
