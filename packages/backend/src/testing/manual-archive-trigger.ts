import { triggerArchiveNow } from "../jobs/archive.job.js";
import { createLogger } from "../utils/logger.js";
import { pathToFileURL } from "url";

const logger = createLogger("ManualArchiveTrigger");

/**
 * Trigger manual archive on-demand for testing purposes.
 * This utility is intentionally not wired to app startup.
 */
export async function triggerManualArchiveForTesting(): Promise<void> {
  logger.info("Running manual archive for testing");

  try {
    const result = await triggerArchiveNow("this-month-testing");
    logger.info("Manual archive testing completed", {
      archived: result.archived,
      deleted: result.deleted,
      duration: `${result.duration}ms`,
    });
  } catch (error) {
    logger.error("Manual archive testing failed", error);
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await triggerManualArchiveForTesting();
}
