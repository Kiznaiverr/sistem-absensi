/**
 * Archive Service
 * Manages automatic archiving of old attendance logs
 * Archives data older than 90 days to separate table
 */

import { supabaseClient } from "../config/database.js";
import { createLogger } from "../utils/logger.js";
import { subDays, formatISO } from "date-fns";

const logger = createLogger("ArchiveService");

export interface ArchiveResult {
  success: boolean;
  archived: number;
  deleted: number;
  duration: number;
  message: string;
}

export class ArchiveService {
  private static readonly ARCHIVE_THRESHOLD_DAYS = 90;

  /**
   * Main archive job - archives data older than 90 days
   * Called daily via cron job at 2 AM (Asia/Jakarta)
   */
  static async archiveOldLogs(options?: {
    thresholdDate?: string;
    thresholdLabel?: string;
  }): Promise<ArchiveResult> {
    const startTime = Date.now();
    const archiveDate = new Date();
    const thresholdDateStr =
      options?.thresholdDate ||
      formatISO(subDays(archiveDate, this.ARCHIVE_THRESHOLD_DAYS), {
        representation: "date",
      });
    const thresholdLabel =
      options?.thresholdLabel || `${this.ARCHIVE_THRESHOLD_DAYS} days`;

    try {
      logger.info("Archive job started", {
        threshold: thresholdDateStr,
        threshold_label: thresholdLabel,
      });

      // Step 1: Verify data integrity
      logger.info("Verifying data integrity...");
      const integrityCheck = await this.verifyDataIntegrity(thresholdDateStr);
      if (!integrityCheck.isValid) {
        throw new Error(
          `Data integrity check failed: ${integrityCheck.errors.join(", ")}`,
        );
      }
      logger.info("Data integrity verified");

      // Step 2: Count records to archive
      logger.info("Counting archivable records...");
      const recordsToArchive =
        await this.countRecordsToArchive(thresholdDateStr);
      logger.info(`Records to archive: ${recordsToArchive}`);

      if (recordsToArchive === 0) {
        logger.info("No records to archive");
        return {
          success: true,
          archived: 0,
          deleted: 0,
          duration: Date.now() - startTime,
          message: "No records older than threshold",
        };
      }

      // Step 3: Copy to archive
      logger.info("Copying records to archive...");
      const copiedCount = await this.copyToArchive(thresholdDateStr);
      logger.info(`Copied ${copiedCount} records to archive`);

      if (copiedCount === 0) {
        throw new Error("Copy operation returned 0 records");
      }

      // Step 4: Verify copy
      logger.info("Verifying archive copy...");
      const verifyResult = await this.verifyArchiveCopy(
        thresholdDateStr,
        recordsToArchive,
      );
      if (!verifyResult.isValid) {
        throw new Error(`Archive verification failed: ${verifyResult.error}`);
      }
      logger.info("Archive copy verified");

      // Step 5: Delete from active
      logger.info("Deleting old records from active table...");
      const deletedCount = await this.deleteFromActive(thresholdDateStr);
      logger.info(`Deleted ${deletedCount} records from active table`);

      // Step 6: Log operation
      await this.logArchiveOperation({
        archiveDate: formatISO(archiveDate, { representation: "date" }),
        thresholdDate: thresholdDateStr,
        recordsCopied: copiedCount,
        recordsDeleted: deletedCount,
        durationMs: Date.now() - startTime,
        status: "success",
        isVerified: true,
      });

      const duration = Date.now() - startTime;
      const result: ArchiveResult = {
        success: true,
        archived: copiedCount,
        deleted: deletedCount,
        duration,
        message: `Successfully archived ${copiedCount} records (${duration}ms)`,
      };

      logger.info("Archive job completed successfully", result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Archive job failed", error);

      // Log failed operation
      await this.logArchiveOperation({
        archiveDate: formatISO(archiveDate, { representation: "date" }),
        thresholdDate: thresholdDateStr,
        recordsCopied: 0,
        recordsDeleted: 0,
        durationMs: duration,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        isVerified: false,
      });

      throw error;
    }
  }

  /**
   * Verify data integrity before archiving
   */
  private static async verifyDataIntegrity(
    thresholdDate: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if there are records to archive at all
      const { count: recordCount, error: countError } = await supabaseClient
        .from("attendance_logs")
        .select("id", { count: "exact", head: true })
        .lt("date", thresholdDate);

      if (countError) {
        errors.push(`Count query error: ${countError.message}`);
      }

      if (recordCount === 0) {
        return { isValid: true, errors };
      }

      // Check for NULL values in required fields
      const { data: nullRecords, error: nullError } = await supabaseClient
        .from("attendance_logs")
        .select("id")
        .lt("date", thresholdDate)
        .or("santri_id.is.null,class_id.is.null,checked_in_at.is.null");

      if (nullError) {
        errors.push(`NULL check error: ${nullError.message}`);
      } else if (nullRecords && nullRecords.length > 0) {
        errors.push(
          `Found ${nullRecords.length} records with NULL values in required fields`,
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error("Integrity check exception", error);
      return {
        isValid: false,
        errors: ["Integrity check failed: " + String(error)],
      };
    }
  }

  /**
   * Count records eligible for archiving
   */
  private static async countRecordsToArchive(
    thresholdDate: string,
  ): Promise<number> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_logs")
        .select("id", { count: "exact", head: true })
        .lt("date", thresholdDate);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error("Count records error", error);
      throw error;
    }
  }

  /**
   * Copy records to archive table with denormalized data
   */
  private static async copyToArchive(thresholdDate: string): Promise<number> {
    try {
      const { data, error } = await supabaseClient.rpc("copy_to_archive", {
        threshold_date: thresholdDate,
      });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      logger.error("Copy to archive error", error);
      throw error;
    }
  }

  /**
   * Verify that archive copy was successful
   */
  private static async verifyArchiveCopy(
    thresholdDate: string,
    expectedCount: number,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_logs_archive")
        .select("id", { count: "exact", head: true })
        .lt("date", thresholdDate);

      if (error) throw error;

      const actualCount = count || 0;

      if (actualCount < expectedCount) {
        return {
          isValid: false,
          error: `Expected ${expectedCount} records, but found ${actualCount} in archive`,
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Verification failed: ${String(error)}`,
      };
    }
  }

  /**
   * Delete from active table after verified
   */
  private static async deleteFromActive(
    thresholdDate: string,
  ): Promise<number> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_logs")
        .delete()
        .lt("date", thresholdDate);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error("Delete from active error", error);
      throw error;
    }
  }

  /**
   * Log archive operation to audit table
   */
  private static async logArchiveOperation(log: {
    archiveDate: string;
    thresholdDate: string;
    recordsCopied: number;
    recordsDeleted: number;
    durationMs: number;
    status: "success" | "failed" | "partial";
    errorMessage?: string;
    isVerified: boolean;
  }): Promise<void> {
    try {
      await supabaseClient.from("archive_operations").insert({
        archive_date: log.archiveDate,
        threshold_date: log.thresholdDate,
        records_copied: log.recordsCopied,
        records_deleted: log.recordsDeleted,
        duration_ms: log.durationMs,
        status: log.status,
        error_message: log.errorMessage || null,
        is_verified: log.isVerified,
        verified_at: log.isVerified ? new Date().toISOString() : null,
      });
    } catch (error) {
      logger.error("Failed to log archive operation", error);
      // Don't throw - logging failure shouldn't break archive
    }
  }

  /**
   * Get archive status and statistics
   */
  static async getArchiveStatus(): Promise<{
    active_records: number;
    archive_records: number;
    threshold_days: number;
    oldest_active_record: string | null;
    health: {
      active_size_ok: boolean;
      archive_ok: boolean;
    };
  }> {
    try {
      // Count active records
      const { count: activeCount, error: activeError } = await supabaseClient
        .from("attendance_logs")
        .select("id", { count: "exact", head: true });

      if (activeError) throw activeError;

      // Count archived records
      const { count: archiveCount, error: archiveError } = await supabaseClient
        .from("attendance_logs_archive")
        .select("id", { count: "exact", head: true });

      if (archiveError) throw archiveError;

      // Get oldest active record
      const { data: oldestData, error: oldestError } = await supabaseClient
        .from("attendance_logs")
        .select("date")
        .order("date", { ascending: true })
        .limit(1)
        .single();

      if (oldestError && oldestError.code !== "PGRST116") throw oldestError;

      return {
        active_records: activeCount || 0,
        archive_records: archiveCount || 0,
        threshold_days: this.ARCHIVE_THRESHOLD_DAYS,
        oldest_active_record: oldestData?.date || null,
        health: {
          active_size_ok: (activeCount || 0) < 100000,
          archive_ok: (archiveCount || 0) < 10000000,
        },
      };
    } catch (error) {
      logger.error("Failed to get archive status", error);
      throw error;
    }
  }

  /**
   * Get archive operation history
   */
  static async getArchiveHistory(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient
        .from("archive_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get archive history", error);
      throw error;
    }
  }
}
