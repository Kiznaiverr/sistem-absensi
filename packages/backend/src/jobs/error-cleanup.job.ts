/**
 * Error Log TTL Cleanup Job
 * Runs hourly to delete attendance error logs older than 24 hours
 */

import cron from "node-cron";
import { AttendanceErrorService } from "../services/attendance-error.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ErrorCleanupJob");

/**
 * Schedule TTL cleanup job to run every hour
 */
export function scheduleErrorCleanupJob() {
  try {
    // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
    const job = cron.schedule("0 * * * *", async () => {
      try {
        logger.info("Error log cleanup job triggered");

        const result = await AttendanceErrorService.cleanupExpiredErrors();

        logger.info("Error log cleanup completed", {
          deleted: result.deleted,
        });
      } catch (error) {
        logger.error("Error log cleanup failed", error);
        // Don't throw - failure should not break the job scheduler
      }
    });

    logger.info("Error log cleanup job scheduled");
    logger.info("Schedule: Every hour at minute 0");

    return job;
  } catch (error) {
    logger.error("Failed to schedule error cleanup job", error);
    throw error;
  }
}

/**
 * Manual trigger for error log cleanup (for testing)
 */
export async function triggerErrorCleanupNow() {
  try {
    logger.info("Manual error cleanup trigger");

    const result = await AttendanceErrorService.cleanupExpiredErrors();

    logger.info("Manual error cleanup completed", result);

    return {
      success: true,
      message: "Error log cleanup completed",
      data: result,
    };
  } catch (error) {
    logger.error("Manual error cleanup failed", error);
    throw error;
  }
}
