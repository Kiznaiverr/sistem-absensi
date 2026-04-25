import { SantriImportJobService } from "../services/santri-import-job.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("SantriImportJob");

export function startSantriImportWorker() {
  const workerTimer = setInterval(() => {
    void SantriImportJobService.processNextQueuedJob();
  }, 2000);

  const cleanupTimer = setInterval(() => {
    void SantriImportJobService.cleanupExpiredJobs();
  }, 60 * 1000);

  logger.info("Santri import worker started");

  return {
    stop: () => {
      clearInterval(workerTimer);
      clearInterval(cleanupTimer);
      logger.info("Santri import worker stopped");
    },
  };
}
