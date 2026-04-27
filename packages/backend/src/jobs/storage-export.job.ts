/**
 * Storage Export Job Scheduler
 * Runs on the 1st of every month at 3:00 AM (Asia/Jakarta)
 * Exports previous month attendance data to R2
 */

import cron from "node-cron";
import { StorageExportService } from "../services/storage-export.service.js";
import { EmailService } from "../services/email.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("StorageExportJob");

/**
 * Schedule storage export job
 * Cron: "0 3 1 * *" = 3:00 AM on day 1 of every month
 */
export function scheduleStorageExportJob() {
  try {
    const job = cron.schedule(
      "0 3 1 * *",
      async () => {
        try {
          logger.info("Storage export job triggered (scheduled)");

          const result = await StorageExportService.exportMonthlyAttendance();

          logger.info("Storage export job completed", {
            exported: result.exported,
            failed: result.failed,
            duration: `${result.duration}ms`,
          });

          // Send success email
          await EmailService.sendStorageExportSuccess(result);
        } catch (error) {
          logger.error("Storage export job failed", error);

          // Send failure email
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await EmailService.sendStorageExportError({
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });
        }
      },
      {
        timezone: "Asia/Jakarta",
      },
    );

    logger.info("Storage export job scheduled");
    logger.info("Schedule: 1st of every month at 3:00 AM (Asia/Jakarta)");

    return job;
  } catch (error) {
    logger.error("Failed to schedule storage export job", error);
    throw error;
  }
}
