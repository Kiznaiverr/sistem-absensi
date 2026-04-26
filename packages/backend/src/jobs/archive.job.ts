/**
 * Archive Job Scheduler
 * Runs automatically every day at 2:00 AM (Asia/Jakarta)
 * Archives attendance logs older than 90 days
 */

import cron from "node-cron";
import { ArchiveService } from "../services/archive.service.js";
import { EmailService } from "../services/email.service.js";
import { createLogger } from "../utils/logger.js";
import { subDays, formatISO, addMonths, startOfMonth } from "date-fns";

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
        let thresholdDate: string | undefined;

        try {
          logger.info("Archive job triggered (scheduled)");

          // Calculate threshold date for error context
          const archiveDate = new Date();
          const thresholdDateObj = subDays(archiveDate, 90);
          thresholdDate = formatISO(thresholdDateObj, {
            representation: "date",
          });

          const result = await ArchiveService.archiveOldLogs();

          logger.info("Archive job completed", {
            archived: result.archived,
            deleted: result.deleted,
            duration: `${result.duration}ms`,
          });

          // Send success email
          await EmailService.sendArchiveSuccess(result);
        } catch (error) {
          logger.error("Archive job failed", error);

          // Send failure email
          const errorMessage =
            error instanceof Error ? error : new Error(String(error));
          await EmailService.sendArchiveFailure(errorMessage, {
            threshold: thresholdDate,
          });
        }
      },
      {
        timezone: "Asia/Jakarta",
        runOnInit: false,
      },
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
export async function triggerArchiveNow(
  mode: "default" | "this-month-testing" = "default",
) {
  let thresholdDate: string | undefined;

  try {
    logger.info("Manual archive trigger");

    if (mode === "this-month-testing") {
      // Testing mode: archive data before the first day of next month,
      // which effectively includes records from the current month.
      const now = new Date();
      const nextMonthStart = startOfMonth(addMonths(now, 1));
      thresholdDate = formatISO(nextMonthStart, { representation: "date" });

      const result = await ArchiveService.archiveOldLogs({
        thresholdDate,
        thresholdLabel: "testing current month",
      });

      logger.info("Manual archive completed (this-month-testing)", result);

      // Send success email
      await EmailService.sendArchiveSuccess(result);

      return result;
    }

    // Default mode (same behavior as scheduled archive): last 90 days retained
    const archiveDate = new Date();
    const thresholdDateObj = subDays(archiveDate, 90);
    thresholdDate = formatISO(thresholdDateObj, { representation: "date" });

    const result = await ArchiveService.archiveOldLogs();
    logger.info("Manual archive completed", result);

    // Send success email
    await EmailService.sendArchiveSuccess(result);

    return result;
  } catch (error) {
    logger.error("Manual archive failed", error);

    // Send failure email
    const errorMessage =
      error instanceof Error ? error : new Error(String(error));
    await EmailService.sendArchiveFailure(errorMessage, {
      threshold: thresholdDate,
    });

    throw error;
  }
}
