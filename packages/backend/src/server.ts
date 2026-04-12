import app from "./app.js";
import env from "./config/env.js";
import { createLogger, initializeErrorLogging } from "./utils/logger.js";
import { AttendanceService } from "./services/attendance.service.js";

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

    logger.info("Application initialization complete");

    app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║       Absensi System - RFID Attendance         ║
║────────────────────────────────────────────────║
║   Backend: http://${HOST}:${PORT}
║   Environment: ${env.NODE_ENV.toUpperCase()}
║   Cache: ${env.CACHE_ENABLED ? "ENABLED" : "DISABLED"}
║   Timezone: ${env.TIMEZONE}
╚════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
