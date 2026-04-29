/**
 * Shift-End Error Summary Job
 * Runs automatically at shift end times to send error summary email
 * Shift times are configured in env: SHIFT_SIANG_END, SHIFT_MALAM_END
 */

import cron from "node-cron";
import { AttendanceErrorService } from "../services/attendance-error.service.js";
import { EmailService } from "../services/email.service.js";
import { createLogger } from "../utils/logger.js";
import env from "../config/env.js";
import { getCurrentDateString } from "../utils/time.js";

const logger = createLogger("ShiftEndJob");

/**
 * Parse time string (HH:MM) into cron schedule
 * Returns cron expression for that time daily
 */
function parseTimeIntoCronExpression(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return `${minutes} ${hours} * * *`; // minute hour * * *
}

/**
 * Schedule shift-end error summary job
 * Runs at SHIFT_SIANG_END and SHIFT_MALAM_END (daily)
 */
export function scheduleShiftEndJobs() {
  try {
    const siangCron = parseTimeIntoCronExpression(env.SHIFT_SIANG_END);
    const malamCron = parseTimeIntoCronExpression(env.SHIFT_MALAM_END);

    // Siang shift-end job
    const siangJob = cron.schedule(siangCron, async () => {
      try {
        logger.info("Shift-end job triggered: SIANG");
        await triggerShiftEndSummary("siang");
      } catch (error) {
        logger.error("Siang shift-end job failed", error);
      }
    });

    // Malam shift-end job
    const malamJob = cron.schedule(malamCron, async () => {
      try {
        logger.info("Shift-end job triggered: MALAM");
        await triggerShiftEndSummary("malam");
      } catch (error) {
        logger.error("Malam shift-end job failed", error);
      }
    });

    logger.info("Shift-end error summary jobs scheduled successfully");

    return { siangJob, malamJob };
  } catch (error) {
    logger.error("Failed to schedule shift-end jobs", error);
    throw error;
  }
}

/**
 * Trigger shift-end error summary
 * Fetches errors for the shift and sends email notification
 */
async function triggerShiftEndSummary(shift: "siang" | "malam"): Promise<void> {
  try {
    const date = getCurrentDateString();

    logger.info("Fetching error summary for shift", { shift, date });

    // Get error summary
    const errorSummary = await AttendanceErrorService.getErrorSummaryByShift(
      date,
      shift,
    );

    logger.info("Error summary retrieved", {
      shift,
      date,
      total_errors: errorSummary.total_errors,
      error_codes_count: errorSummary.errors_by_code.length,
    });

    // Only send email if there are errors
    if (errorSummary.total_errors > 0) {
      await EmailService.sendShiftEndErrorSummary({
        shift,
        date,
        total_errors: errorSummary.total_errors,
        errors_by_code: errorSummary.errors_by_code.map((group) => ({
          error_code: group.error_code,
          error_message: group.error_message,
          count: group.count,
          details: group.details.map((detail) => ({
            rfid_id: detail.rfid_id,
            santri_name: detail.santri_name,
            timestamp: detail.timestamp,
            error_message: detail.error_message,
          })),
        })),
      });

      logger.info("Shift-end error summary email sent", {
        shift,
        date,
        total_errors: errorSummary.total_errors,
      });
    } else {
      logger.info("No errors found for shift, skipping email notification", {
        shift,
        date,
      });
    }
  } catch (error) {
    logger.error("Failed to trigger shift-end summary", { shift, error });
    // Don't throw - failure should not break the job scheduler
  }
}

/**
 * Manual trigger for shift-end error summary (for testing or admin panel)
 */
export async function triggerShiftEndSummaryNow(shift: "siang" | "malam") {
  try {
    logger.info("Manual shift-end summary trigger", { shift });
    await triggerShiftEndSummary(shift);
    return {
      success: true,
      message: `Shift-end error summary sent for ${shift}`,
    };
  } catch (error) {
    logger.error("Manual shift-end summary trigger failed", error);
    throw error;
  }
}
