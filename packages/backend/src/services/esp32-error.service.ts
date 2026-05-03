/**
 * ESP32 Error Service
 * Stores and retrieves error logs reported by ESP32 devices
 */

import { supabaseClient } from "../config/database.js";
import { createLogger } from "../utils/logger.js";
import { formatDateTime, getCurrentDateString } from "../utils/time.js";

const logger = createLogger("Esp32ErrorService");

export interface Esp32ErrorLog {
  id: string;
  device_id: string;
  error_code: string;
  error_message: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  request_date: string;
  expires_at: string;
  created_at: string;
}

export class Esp32ErrorService {
  static async logError(errorData: {
    device_id: string;
    error_code: string;
    error_message: string;
    metadata?: Record<string, unknown> | null;
    timestamp?: number;
  }): Promise<void> {
    try {
      const timestamp = errorData.timestamp || Date.now();
      const requestDate = getCurrentDateString();
      const expiresAt = new Date(timestamp);
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabaseClient.from("esp32_error_logs").insert({
        device_id: errorData.device_id,
        error_code: errorData.error_code,
        error_message: errorData.error_message,
        metadata: errorData.metadata || null,
        timestamp: new Date(timestamp).toISOString(),
        request_date: requestDate,
        expires_at: expiresAt.toISOString(),
      });
      if (error) {
        // Fallback: some deployments may not have DB migration applied yet
        // that adds `expires_at`. If Supabase/PostgREST reports missing
        // column, retry without `expires_at` to remain backwards compatible.
        logger.warn("Initial insert failed for esp32_error_logs", { error });

        const missingExpires =
          error?.code === "PGRST204" ||
          (typeof error?.message === "string" &&
            error.message.includes("Could not find the 'expires_at' column"));

        if (missingExpires) {
          try {
            const { error: retryError } = await supabaseClient
              .from("esp32_error_logs")
              .insert({
                device_id: errorData.device_id,
                error_code: errorData.error_code,
                error_message: errorData.error_message,
                metadata: errorData.metadata || null,
                timestamp: new Date(timestamp).toISOString(),
                request_date: requestDate,
              });

            if (retryError) {
              logger.error("Retry insert without expires_at failed", {
                retryError,
                errorData,
              });
            } else {
              logger.info("Logged ESP32 error without expires_at", {
                errorData,
              });
            }
          } catch (retryErr) {
            logger.error("Retry insert without expires_at threw", retryErr);
          }
        } else {
          logger.error("Failed to log ESP32 error", { error, errorData });
        }
      }
    } catch (err) {
      logger.error("Error logging ESP32 error", err);
    }
  }

  static async getErrors(options?: {
    limit?: number;
    offset?: number;
    device_id?: string;
    error_code?: string;
    date?: string;
    request_date?: string;
  }): Promise<{
    data: Esp32ErrorLog[];
    count: number;
    total: number;
  }> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      let query = supabaseClient
        .from("esp32_error_logs")
        .select("*", { count: "exact" });

      if (options?.device_id && options.device_id !== "all") {
        query = query.eq("device_id", options.device_id);
      }
      if (options?.error_code) {
        query = query.eq("error_code", options.error_code);
      }
      const requestDate = options?.date || options?.request_date;
      if (requestDate) {
        query = query.eq("request_date", requestDate);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const { count: totalCount } = await supabaseClient
        .from("esp32_error_logs")
        .select("*", { count: "exact", head: true });

      return {
        data: (data || []).map((log) => ({
          ...log,
          timestamp: formatDateTime(new Date(log.timestamp)),
          created_at: formatDateTime(new Date(log.created_at)),
          expires_at: formatDateTime(new Date(log.expires_at)),
        })),
        count: count || 0,
        total: totalCount || 0,
      };
    } catch (error) {
      logger.error("Failed to get ESP32 errors", error);
      throw error;
    }
  }

  static async cleanupExpiredErrors(): Promise<{ deleted: number }> {
    try {
      const { count, error } = await supabaseClient
        .from("esp32_error_logs")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (error) throw error;

      logger.info("Cleaned up expired ESP32 errors", { count });

      return { deleted: count || 0 };
    } catch (error) {
      logger.error("Failed to cleanup expired ESP32 errors", error);
      throw error;
    }
  }
}
