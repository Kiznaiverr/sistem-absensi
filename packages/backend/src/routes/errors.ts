/**
 * Attendance Error Routes
 * Handles error log retrieval and management
 * All routes require JWT authentication
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { query, body, validationResult } from "express-validator";
import { AttendanceErrorService } from "../services/attendance-error.service.js";
import { createLogger } from "../utils/logger.js";

const router: ExpressRouter = Router();
const logger = createLogger("AttendanceErrorRoutes");

/**
 * Handle validation errors
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      errors: errors.array().map((error: any) => ({
        field: error.param,
        message: error.msg,
      })),
    });
    return;
  }
  next();
};

/**
 * GET /api/attendance/errors
 * Get error logs with optional filtering
 * Query params: limit, offset, error_code, request_date, resolved, rfid_id
 */
router.get(
  "/",
  [
    query("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
    query("offset").optional().isInt({ min: 0 }).toInt(),
    query("error_code").optional().isString().trim(),
    query("request_date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/),
    query("resolved").optional().isIn(["true", "false"]),
    query("rfid_id").optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = await AttendanceErrorService.getErrors({
        limit: (req.query.limit as any) || 50,
        offset: (req.query.offset as any) || 0,
        error_code: (req.query.error_code as string) || undefined,
        request_date: (req.query.request_date as string) || undefined,
        resolved:
          (req.query.resolved as string) === "true"
            ? true
            : (req.query.resolved as string) === "false"
              ? false
              : undefined,
        rfid_id: (req.query.rfid_id as string) || undefined,
      });

      res.json({
        success: true,
        data: errors,
      });
    } catch (error) {
      logger.error("Error getting error logs", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/errors/summary/:shift
 * Get error summary for shift end notification
 * Path params: shift (siang|malam)
 * Query params: date (YYYY-MM-DD, defaults to today)
 */
router.get(
  "/summary/:shift",
  [
    query("date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shift } = req.params;
      const date =
        (req.query.date as string) || new Date().toISOString().split("T")[0];

      if (!["siang", "malam"].includes(shift)) {
        return res.status(400).json({
          success: false,
          error: "Invalid shift. Must be 'siang' or 'malam'",
        });
      }

      const summary = await AttendanceErrorService.getErrorSummaryByShift(
        date,
        shift as "siang" | "malam",
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error("Error getting error summary", error);
      next(error);
    }
  },
);

/**
 * DELETE /api/attendance/errors/:id
 * Delete single error log
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await AttendanceErrorService.deleteError(id);

      res.json({
        success: true,
        message: "Error log deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting error log", error);
      next(error);
    }
  },
);

/**
 * DELETE /api/attendance/errors
 * Delete all error logs (requires confirmation token in body)
 * CAUTION: This deletes ALL errors
 */
router.delete(
  "/",
  [body("confirm_delete").equals("true").withMessage("Must confirm deletion")],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AttendanceErrorService.deleteAllErrors();

      logger.warn("All error logs deleted via API", result);

      res.json({
        success: true,
        message: "All error logs deleted successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error deleting all error logs", error);
      next(error);
    }
  },
);

/**
 * POST /api/attendance/errors/bulk-delete
 * Delete multiple error logs by IDs
 * Body: { ids: [id1, id2, ...] }
 */
router.post(
  "/bulk-delete",
  [
    body("ids")
      .isArray({ min: 1 })
      .withMessage("ids must be a non-empty array"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;

      const result = await AttendanceErrorService.deleteErrorsByIds(ids);

      res.json({
        success: true,
        message: "Error logs deleted successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error deleting error logs in bulk", error);
      next(error);
    }
  },
);

/**
 * DELETE /api/attendance/errors/by-date/:date
 * Delete all error logs for a specific date
 */
router.delete(
  "/by-date/:date",
  [
    query("date")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Date must be in YYYY-MM-DD format"),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date } = req.params;

      const result = await AttendanceErrorService.deleteErrorsByDate(date);

      res.json({
        success: true,
        message: "Error logs for date deleted successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error deleting error logs by date", error);
      next(error);
    }
  },
);

/**
 * PATCH /api/attendance/errors/:id/resolve
 * Mark error as resolved
 * Body: { resolved_by?: string, notes?: string }
 */
router.patch(
  "/:id/resolve",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { resolved_by, notes } = req.body;

      await AttendanceErrorService.markResolved(id, resolved_by, notes);

      res.json({
        success: true,
        message: "Error marked as resolved",
      });
    } catch (error) {
      logger.error("Error marking error as resolved", error);
      next(error);
    }
  },
);

/**
 * POST /api/attendance/errors/cleanup
 * Manual cleanup of expired error logs (>24h old)
 * This can be called manually or via cron job
 */
router.post(
  "/cleanup",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AttendanceErrorService.cleanupExpiredErrors();

      logger.info("Manual cleanup executed", result);

      res.json({
        success: true,
        message: "Expired error logs cleaned up",
        data: result,
      });
    } catch (error) {
      logger.error("Error during cleanup", error);
      next(error);
    }
  },
);

export default router;
