/**
 * Archive Job Scheduler
 * Runs automatically every day at 2:00 AM (Asia/Jakarta)
 * Archives attendance logs older than 90 days
 */

import cron from "node-cron";
import { ArchiveService } from "../services/archive.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ArchiveJob");

/**
 * Schedule archive job to run daily at 2:00 AM (Asia/Jakarta timezone)
 * Cron format: "0 2 * * *" means: minute=0, hour=2, day=*, month=*, weekday=*
 */
export function scheduleArchiveJob() {
  try {
    const job = cron.schedule(
      "0 2 * * *",
      async () => {
        try {
          logger.info("Archive job triggered (scheduled)");

          const result = await ArchiveService.archiveOldLogs();

          logger.info("Archive job completed", {
            archived: result.archived,
            deleted: result.deleted,
            duration: `${result.duration}ms`,
          });
        } catch (error) {
          logger.error("Archive job failed", error);
          // TODO: Add alert notification here (email, Slack, etc.)
        }
      },
      {
        timezone: "Asia/Jakarta",
        runOnInit: false,
      }
    );

    logger.info("Archive job scheduler initialized");
    logger.info("Schedule: Daily at 2:00 AM (Asia/Jakarta)");

    return job;
  } catch (error) {
    logger.error("Failed to schedule archive job", error);
    throw error;
  }
}

/**
 * Manual trigger for archive (for testing or admin panel)
 */
export async function triggerArchiveNow() {
  try {
    logger.info("Manual archive trigger");
    const result = await ArchiveService.archiveOldLogs();
    logger.info("Manual archive completed", result);
    return result;
  } catch (error) {
    logger.error("Manual archive failed", error);
    throw error;
  }
}
