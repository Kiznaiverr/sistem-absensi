import app from "./app.js";
import env from "./config/env.js";
import { createLogger, initializeErrorLogging } from "./utils/logger.js";
import { AttendanceService } from "./services/attendance.service.js";
import { scheduleArchiveJob } from "./jobs/archive.job.js";
import { scheduleStorageExportJob } from "./jobs/storage-export.job.js";
import { startSantriImportWorker } from "./jobs/santri-import.job.js";

const logger = createLogger("Server");

// Start server
const PORT = env.SERVER_PORT;
const HOST = env.SERVER_HOST;

// Initialize app
async function startServer() {
  try {
    logger.info("Initializing application...");

    // Initialize error logging (create logs directory)
    initializeErrorLogging();

    // Initialize cache with santri data
    if (env.CACHE_ENABLED) {
      await AttendanceService.initializeCache();
    }

    // Initialize archive job scheduler
    scheduleArchiveJob();

    // Initialize storage export job scheduler
    scheduleStorageExportJob();

    // Initialize santri import background worker
    startSantriImportWorker();

    logger.info("Application initialization complete");

    app.listen(PORT, HOST, () => {
      logger.info("Server started successfully");
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
