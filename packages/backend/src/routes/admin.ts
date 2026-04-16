/**
 * Admin Routes
 * Management endpoints for archive operations and system monitoring
 * All routes require valid JWT token (validateToken middleware applied in app.ts)
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { ArchiveService } from "../services/archive.service.js";
import { DatabaseService } from "../services/database.service.js";
import { createLogger } from "../utils/logger.js";
import { triggerArchiveNow } from "../jobs/archive.job.js";

const router: ExpressRouter = Router();
const logger = createLogger("AdminRoutes");

/**
 * GET /api/admin/archive/status
 * Get current archive status and statistics
 * Requires: Valid JWT token
 * Returns: active records count, archive records count, health status
 */
router.get(
  "/archive/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await ArchiveService.getArchiveStatus();

      res.json({
        success: true,
        data: {
          current_time: new Date().toISOString(),
          archive_threshold_days: 90,
          next_scheduled_run: "Daily at 2:00 AM (Asia/Jakarta)",
          ...status,
        },
      });
    } catch (error) {
      logger.error("Failed to get archive status", error);
      res.status(500).json({
        success: false,
        error: "Failed to get archive status",
        error_code: "ARCHIVE_STATUS_FAILED",
      });
    }
  },
);

/**
 * POST /api/admin/archive/manual
 * Manually trigger archive operation (for testing or emergency)
 * Can be called by admin users
 */
router.post(
  "/archive/manual",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.warn("Manual archive triggered");

      const result = await triggerArchiveNow();

      res.json({
        success: true,
        data: {
          archived: result.archived,
          deleted: result.deleted,
          duration: `${result.duration}ms`,
          message: result.message,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Manual archive failed", error);
      res.status(500).json({
        success: false,
        error: "Archive operation failed",
        error_code: "ARCHIVE_FAILED",
      });
    }
  },
);

/**
 * GET /api/admin/archive/history
 * Get archive operation logs
 * Returns last 50 archive operations
 */
router.get(
  "/archive/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = await ArchiveService.getArchiveHistory(limit);

      res.json({
        success: true,
        data: {
          total: history.length,
          operations: history,
        },
      });
    } catch (error) {
      logger.error("Failed to get archive history", error);
      res.status(500).json({
        success: false,
        error: "Failed to get archive history",
        error_code: "ARCHIVE_HISTORY_FAILED",
      });
    }
  },
);

/**
 * GET /api/admin/stats
 * General system statistics
 */
router.get(
  "/stats",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const activeCount = await DatabaseService.countActiveRecords();
      const archiveCount = await DatabaseService.countArchivedRecords();
      const oldestActive = await DatabaseService.getOldestActiveRecord();

      res.json({
        success: true,
        data: {
          database: {
            active_records: activeCount,
            archive_records: archiveCount,
            oldest_active_record: oldestActive,
            total_records: activeCount + archiveCount,
          },
          health: {
            active_size_ok: activeCount < 100000,
            archive_size_ok: archiveCount < 10000000,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to get statistics", error);
      res.status(500).json({
        success: false,
        error: "Failed to get statistics",
        error_code: "STATS_FAILED",
      });
    }
  },
);

export default router;
