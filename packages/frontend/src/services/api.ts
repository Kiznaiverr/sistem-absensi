/**
 * API Service - Frontend HTTP client
 * Handles all API calls to backend
 */

import type {
  BatchAttendanceRequest,
  BatchAttendanceResponse,
} from "@absensi/shared/types";
import { AuthService } from "./auth";
import { FrontendCacheService } from "./cache";

const API_BASE_URL = "/api";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}

export class ApiService {
  /**
   * Make HTTP request with authentication
   * AuthService.fetch automatically handles:
   * - Including HttpOnly cookies (credentials: 'include')
   * - Auto-refresh on 401 (token expired)
   * - Retry after refresh
   */
  private static async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await AuthService.fetch(url, options);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "API Error");
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        // Handle 401/403 - redirect to login for re-authentication
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("Forbidden")
        ) {
          window.location.href = "/";
        }
      }
      throw error;
    }
  }

  /**
   * POST /api/attendance/batch
   * Submit batch of RFID scans
   */
  static async submitAttendanceBatch(
    request: BatchAttendanceRequest,
  ): Promise<BatchAttendanceResponse> {
    const response = await this.request<ApiResponse<BatchAttendanceResponse>>(
      "POST",
      "/attendance/batch",
      request,
    );
    return response.data!;
  }

  /**
   * GET /api/attendance/today
   * Get today's attendance summary
   */
  static async getTodaySummary(): Promise<{
    date: string;
    siang_count: number;
    malam_count: number;
    total_count: number;
  }> {
    const response = await this.request<ApiResponse>(
      "GET",
      "/attendance/today",
    );
    return response.data!;
  }

  /**
   * GET /api/attendance/month
   * Get monthly attendance data
   */
  static async getMonthlyAttendance(
    month?: number,
    year?: number,
    filters?: { school_type?: string; class_id?: string; shift?: string },
  ): Promise<any> {
    const params = new URLSearchParams();
    if (month !== undefined) params.append("month", month.toString());
    if (year !== undefined) params.append("year", year.toString());
    if (filters?.school_type) params.append("school_type", filters.school_type);
    if (filters?.class_id) params.append("class_id", filters.class_id);
    if (filters?.shift) params.append("shift", filters.shift);

    const response = await this.request<ApiResponse>(
      "GET",
      `/attendance/month?${params.toString()}`,
    );
    return response.data!;
  }

  /**
   * GET /api/attendance/export
   * Export attendance data as JSON
   */
  static async exportAttendance(filters: {
    month: number;
    year: number;
    shift: "siang" | "malam";
    school_type?: string;
    class_id?: string;
  }): Promise<{
    month: number;
    year: number;
    monthName: string;
    shift: string;
    schoolType: string | null;
    daysInMonth: number;
    classMatrices: any[];
    generatedAt: string;
  }> {
    const params = new URLSearchParams();
    params.append("month", filters.month.toString());
    params.append("year", filters.year.toString());
    params.append("shift", filters.shift);
    if (filters?.school_type) params.append("school_type", filters.school_type);
    if (filters?.class_id) params.append("class_id", filters.class_id);

    const url = `${API_BASE_URL}/attendance/export?${params.toString()}`;

    try {
      const response = await AuthService.fetch(url);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No authentication token"
      ) {
        window.location.href = "/";
      }
      throw error;
    }
  }

  /**
   * GET /api/classes
   * Get all classes
   * Uses 1-hour cache to reduce network requests
   */
  static async getClasses(): Promise<any[]> {
    // Check cache first
    const cached = FrontendCacheService.getClasses();
    if (cached) {
      console.log(`[Cache HIT] Classes list`);
      return cached;
    }

    console.log(`[Cache MISS] Fetching classes from API`);
    const response = await this.request<ApiResponse>("GET", "/classes");
    const classes = response.data || [];

    // Store in cache
    FrontendCacheService.setClasses(classes);

    return classes;
  }

  /**
   * GET /api/classes/:classId/santri
   * Get santri by class ID
   */
  static async getSantriByClass(classId: string): Promise<any[]> {
    const response = await this.request<ApiResponse>(
      "GET",
      `/classes/${classId}/santri`,
    );
    return response.data || [];
  }

  /**
   * GET /api/attendance/available-months
   * Get available months and years with attendance data
   * Uses 30-minute cache to reduce network requests
   */
  static async getAvailableMonths(shift: "siang" | "malam"): Promise<{
    years: number[];
    months_by_year: Record<number, number[]>;
  }> {
    // Check cache first
    const cached = FrontendCacheService.getAvailableMonths(shift);
    if (cached) {
      console.log(`[Cache HIT] Available months for ${shift}`);
      return cached;
    }

    console.log(`[Cache MISS] Fetching available months for ${shift}`);
    const response = await this.request<ApiResponse>(
      "GET",
      `/attendance/available-months?shift=${shift}`,
    );
    const data = response.data || { years: [], months_by_year: {} };

    // Store in cache
    FrontendCacheService.setAvailableMonths(shift, data);

    return data;
  }

  /**
   * POST /api/classes/init-cache
   * Reinitialize cache (internal endpoint)
   */
  static async reinitializeCache(): Promise<any> {
    const response = await this.request<ApiResponse>(
      "POST",
      "/classes/init-cache",
    );
    return response.data;
  }

  // ===== SANTRI MANAGEMENT ENDPOINTS =====

  /**
   * GET /api/santri
   * Get all santri with optional filters
   * Uses 5-minute cache to reduce network requests (only when no filters)
   */
  static async getAllSantri(
    filters?: {
      class_id?: string;
      search?: string;
      is_active?: boolean;
    },
    options?: {
      bypassCache?: boolean;
    },
  ): Promise<any[]> {
    const bypassCache = options?.bypassCache === true;

    // Only use cache if no meaningful filters
    // Filters are considered "active" only if they have non-default values
    const hasActiveFilters =
      filters &&
      (filters.class_id || filters.search || filters.is_active === false); // Only false is meaningful (show inactive)

    if (!hasActiveFilters && !bypassCache) {
      const cached = FrontendCacheService.getSantri();
      if (cached && cached.length > 0) {
        console.log(`[Cache HIT] Santri list`);
        return cached as any[];
      }
    }

    const params = new URLSearchParams();
    if (filters?.class_id) params.append("class_id", filters.class_id);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active === false) params.append("is_active", "false");
    if (bypassCache) params.append("_ts", Date.now().toString());

    const queryStr = params.toString();
    console.log(
      `[Cache ${bypassCache ? "BYPASS" : hasActiveFilters ? "SKIP" : "MISS"}] Fetching santri from API`,
    );
    const response = await this.request<ApiResponse>(
      "GET",
      `/santri${queryStr ? "?" + queryStr : ""}`,
    );
    const santriList = response.data || [];

    // Cache only if no active filters
    if (!hasActiveFilters) {
      FrontendCacheService.setSantri(santriList);
    }

    return santriList;
  }

  /**
   * POST /api/santri
   * Create new santri
   */
  static async createSantri(data: {
    name: string;
    rfid_id: string;
    class_id: string;
  }): Promise<any> {
    const response = await this.request<ApiResponse>("POST", "/santri", data);
    return response.data;
  }

  /**
   * GET /api/santri/:santriId
   * Get single santri by ID
   */
  static async getSantriById(santriId: string): Promise<any> {
    const response = await this.request<ApiResponse>(
      "GET",
      `/santri/${santriId}`,
    );
    return response.data;
  }

  /**
   * PUT /api/santri/:santriId
   * Update santri (name, class, status)
   */
  static async updateSantri(
    santriId: string,
    data: {
      name?: string;
      class_id?: string;
      is_active?: boolean;
    },
  ): Promise<any> {
    const response = await this.request<ApiResponse>(
      "PUT",
      `/santri/${santriId}`,
      data,
    );
    return response.data;
  }

  /**
   * PATCH /api/santri/:santriId/rfid
   * Update RFID only
   */
  static async updateSantriRFID(
    santriId: string,
    rfidId: string,
  ): Promise<any> {
    const response = await this.request<ApiResponse>(
      "PATCH",
      `/santri/${santriId}/rfid`,
      { rfid_id: rfidId },
    );
    return response.data;
  }

  /**
   * DELETE /api/santri/:santriId
   * Soft delete santri
   */
  static async deleteSantri(santriId: string): Promise<any> {
    const response = await this.request<ApiResponse>(
      "DELETE",
      `/santri/${santriId}`,
    );
    return response.data;
  }

  /**
   * GET /api/santri/template
   * Download Excel template for import
   */
  static async downloadSantriTemplate(): Promise<void> {
    const url = `${API_BASE_URL}/santri/template`;

    try {
      const response = await AuthService.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Get blob and create download link
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "template_santri.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No authentication token"
      ) {
        window.location.href = "/";
      }
      throw error;
    }
  }

  /**
   * POST /api/santri/import-jobs
   * Create background import job
   */
  static async createSantriImportJob(file: File): Promise<{
    job_id: string;
    status: string;
    progress_percent: number;
    created_at: string;
    expires_at?: string | null;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_BASE_URL}/santri/import-jobs`;

    try {
      const response = await AuthService.fetch(url, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const payload = await response.json();
      return payload.data;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No authentication token"
      ) {
        window.location.href = "/";
      }
      throw error;
    }
  }

  /**
   * GET /api/santri/import-jobs/:jobId/progress
   * Subscribe to background import progress stream
   */
  static subscribeSantriImportProgress(jobId: string): EventSource {
    const eventSource = new EventSource(
      `${API_BASE_URL}/santri/import-jobs/${jobId}/progress`,
    );

    return eventSource;
  }

  /**
   * GET /api/santri/import-jobs/:jobId
   * Get import job status
   */
  static async getSantriImportJob(jobId: string): Promise<{
    job_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    stage: string | null;
    message: string | null;
    progress_percent: number;
    total_rows: number;
    processed_rows: number;
    success_count: number;
    error_count: number;
    created_at: string;
    started_at?: string | null;
    finished_at?: string | null;
    expires_at?: string | null;
  }> {
    const response = await this.request<ApiResponse>(
      "GET",
      `/santri/import-jobs/${jobId}`,
    );
    return response.data!;
  }

  /**
   * GET /api/santri/import-jobs/:jobId/errors
   * Get import row-level errors
   */
  static async getSantriImportJobErrors(jobId: string): Promise<any[]> {
    const response = await this.request<ApiResponse>(
      "GET",
      `/santri/import-jobs/${jobId}/errors`,
    );
    return response.data || [];
  }

  /**
   * GET /api/santri/import-jobs/:jobId/errors/export
   * Download import error rows as Excel
   */
  static async exportSantriImportErrors(jobId: string): Promise<void> {
    const url = `${API_BASE_URL}/santri/import-jobs/${jobId}/errors/export`;

    try {
      const response = await AuthService.fetch(url);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `import-errors-${jobId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No authentication token"
      ) {
        window.location.href = "/";
      }
      throw error;
    }
  }

  /**
   * Clear frontend santri cache so next fetch reflects latest import.
   */
  static async invalidateSantriCache(): Promise<void> {
    return FrontendCacheService.clearSantriCache();
  }
}
