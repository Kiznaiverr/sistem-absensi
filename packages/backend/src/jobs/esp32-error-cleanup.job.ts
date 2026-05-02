/**
 * ESP32 Error Log Cleanup Job
 * Runs weekly to delete ESP32 error logs older than 7 days
 */

import cron from "node-cron";
import { Esp32ErrorService } from "../services/esp32-error.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Esp32ErrorCleanupJob");

/**
 * Schedule TTL cleanup job to run every Sunday at midnight
 */
export function scheduleEsp32ErrorCleanupJob() {
  try {
    const job = cron.schedule("0 0 * * 0", async () => {
      try {
        logger.info("ESP32 error cleanup job triggered");

        const result = await Esp32ErrorService.cleanupExpiredErrors();

        logger.info("ESP32 error cleanup completed", {
          deleted: result.deleted,
        });
      } catch (error) {
        logger.error("ESP32 error cleanup failed", error);
      }
    });

    logger.info("ESP32 error cleanup job scheduled");
    logger.info("Schedule: Every Sunday at 00:00");

    return job;
  } catch (error) {
    logger.error("Failed to schedule ESP32 error cleanup job", error);
    throw error;
  }
}

/**
 * Manual trigger for ESP32 error cleanup (for testing)
 */
export async function triggerEsp32ErrorCleanupNow() {
  try {
    logger.info("Manual ESP32 error cleanup trigger");

    const result = await Esp32ErrorService.cleanupExpiredErrors();

    logger.info("Manual ESP32 error cleanup completed", result);

    return {
      success: true,
      message: "ESP32 error cleanup completed",
      data: result,
    };
  } catch (error) {
    logger.error("Manual ESP32 error cleanup failed", error);
    throw error;
  }
}
