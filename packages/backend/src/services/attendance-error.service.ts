/**
 * Attendance Error Service
 * Manages error logging for attendance scans
 * Handles: save errors, retrieve, delete, TTL management
 */

import { supabaseClient } from "../config/database.js";
import { createLogger } from "../utils/logger.js";
import { getCurrentDateString } from "../utils/time.js";

const logger = createLogger("AttendanceErrorService");

export interface AttendanceErrorLog {
  id: string;
  rfid_id: string;
  error_code: string;
  error_message: string;
  shift?: string;
  santri_id?: string;
  class_id?: string;
  santri_name?: string;
  timestamp: string;
  request_date: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  notes?: string;
  created_at: string;
  expires_at: string;
}

export class AttendanceErrorService {
  /**
   * Log an attendance error to database
   * Excluded errors: ALREADY_CHECKED_SIANG, ALREADY_CHECKED_MALAM
   */
  static async logError(errorData: {
    rfid_id: string;
    error_code: string;
    error_message: string;
    shift?: string;
    santri_id?: string;
    class_id?: string;
    santri_name?: string;
    timestamp?: number;
  }): Promise<void> {
    try {
      // Skip logging for duplicate check errors
      if (
        errorData.error_code === "ALREADY_CHECKED_SIANG" ||
        errorData.error_code === "ALREADY_CHECKED_MALAM"
      ) {
        return;
      }

      const timestamp = errorData.timestamp || Date.now();
      const today = getCurrentDateString();

      const { error } = await supabaseClient
        .from("attendance_error_logs")
        .insert({
          rfid_id: errorData.rfid_id,
          error_code: errorData.error_code,
          error_message: errorData.error_message,
          shift: errorData.shift || null,
          santri_id: errorData.santri_id || null,
          class_id: errorData.class_id || null,
          santri_name: errorData.santri_name || null,
          timestamp: new Date(timestamp).toISOString(),
          request_date: today,
          resolved: false,
        });

      if (error) {
        logger.error("Failed to log error", { error, errorData });
      }
    } catch (err) {
      logger.error("Error logging attendance error", err);
      // Don't throw - error logging shouldn't break main flow
    }
  }

  /**
   * Get error logs with optional filtering
   */
  static async getErrors(options?: {
    limit?: number;
    offset?: number;
    error_code?: string;
    request_date?: string;
    resolved?: boolean;
    rfid_id?: string;
  }): Promise<{
    data: AttendanceErrorLog[];
    count: number;
    total: number;
  }> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      let query = supabaseClient
        .from("attendance_error_logs")
        .select("*", { count: "exact" });

      // Apply filters
      if (options?.error_code) {
        query = query.eq("error_code", options.error_code);
      }
      if (options?.request_date) {
        query = query.eq("request_date", options.request_date);
      }
      if (options?.resolved !== undefined) {
        query = query.eq("resolved", options.resolved);
      }
      if (options?.rfid_id) {
        query = query.ilike("rfid_id", `%${options.rfid_id}%`);
      }

      // Sort by created_at DESC, paginate
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get total count
      const { count: totalCount } = await supabaseClient
        .from("attendance_error_logs")
        .select("*", { count: "exact", head: true });

      return {
        data: data || [],
        count: count || 0,
        total: totalCount || 0,
      };
    } catch (error) {
      logger.error("Failed to get errors", error);
      throw error;
    }
  }

  /**
   * Get error summary for shift end notification
   * Returns count by error_code for given date and shift
   */
  static async getErrorSummaryByShift(
    date: string,
    shift: "siang" | "malam",
  ): Promise<{
    total_errors: number;
    errors_by_code: Array<{
      error_code: string;
      error_message: string;
      count: number;
      details: AttendanceErrorLog[];
    }>;
  }> {
    try {
      const { data, error } = await supabaseClient
        .from("attendance_error_logs")
        .select("*")
        .eq("request_date", date)
        .eq("shift", shift)
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const groupedByCode: {
        [key: string]: {
          message: string;
          details: AttendanceErrorLog[];
        };
      } = {};

      (data || []).forEach((log) => {
        if (!groupedByCode[log.error_code]) {
          groupedByCode[log.error_code] = {
            message: log.error_message,
            details: [],
          };
        }
        groupedByCode[log.error_code].details.push(log as AttendanceErrorLog);
      });

      const errorsSummary = Object.entries(groupedByCode).map(
        ([code, group]) => ({
          error_code: code,
          error_message: group.message,
          count: group.details.length,
          details: group.details,
        }),
      );

      return {
        total_errors: data?.length || 0,
        errors_by_code: errorsSummary,
      };
    } catch (error) {
      logger.error("Failed to get error summary", error);
      throw error;
    }
  }

  /**
   * Delete single error log
   */
  static async deleteError(id: string): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from("attendance_error_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      logger.info("Error log deleted", { id });
    } catch (error) {
      logger.error("Failed to delete error", error);
      throw error;
    }
  }

  /**
   * Delete multiple error logs by IDs
   */
  static async deleteErrorsByIds(ids: string[]): Promise<{ deleted: number }> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_error_logs")
        .delete()
        .in("id", ids);

      if (error) throw error;
      logger.info("Deleted error logs", { count, ids_count: ids.length });

      return { deleted: count || 0 };
    } catch (error) {
      logger.error("Failed to delete errors by IDs", error);
      throw error;
    }
  }

  /**
   * Delete all error logs for a date
   */
  static async deleteErrorsByDate(date: string): Promise<{ deleted: number }> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_error_logs")
        .delete()
        .eq("request_date", date);

      if (error) throw error;
      logger.info("Deleted all errors for date", { date, count });

      return { deleted: count || 0 };
    } catch (error) {
      logger.error("Failed to delete errors by date", error);
      throw error;
    }
  }

  /**
   * Delete ALL error logs (use with caution)
   */
  static async deleteAllErrors(): Promise<{ deleted: number }> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_error_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Match all

      if (error) throw error;
      logger.warn("All error logs deleted", { count });

      return { deleted: count || 0 };
    } catch (error) {
      logger.error("Failed to delete all errors", error);
      throw error;
    }
  }

  /**
   * Mark error as resolved
   */
  static async markResolved(
    id: string,
    resolvedBy?: string,
    notes?: string,
  ): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from("attendance_error_logs")
        .update({
          resolved: true,
          resolved_by: resolvedBy || null,
          resolved_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq("id", id);

      if (error) throw error;
      logger.info("Error marked as resolved", { id });
    } catch (error) {
      logger.error("Failed to mark error as resolved", error);
      throw error;
    }
  }

  /**
   * Cleanup expired error logs (older than 24h)
   * This can be called manually or via cron job
   */
  static async cleanupExpiredErrors(): Promise<{ deleted: number }> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_error_logs")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (error) throw error;
      logger.info("Cleaned up expired errors", { count });

      return { deleted: count || 0 };
    } catch (error) {
      logger.error("Failed to cleanup expired errors", error);
      throw error;
    }
  }
}
