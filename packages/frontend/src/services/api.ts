/**
 * API Service - Frontend HTTP client
 * Handles all API calls to backend
 */

import type {
  BatchAttendanceRequest,
  BatchAttendanceResponse,
} from "@absensi/shared/types";
import { AuthService } from "./auth";

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
   */
  private static async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
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
      if (
        error instanceof Error &&
        error.message === "No authentication token"
      ) {
        // Token missing, redirect to login
        window.location.href = "/";
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
   */
  static async getClasses(): Promise<any[]> {
    const response = await this.request<ApiResponse>("GET", "/classes");
    return response.data || [];
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
}
