/**
 * Attendance Routes
 * Handles RFID attendance data processing and retrieval
 * All routes require JWT authentication
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { body, query, validationResult } from "express-validator";
import { AttendanceService } from "../services/attendance.service.js";
import { DatabaseService } from "../services/database.service.js";
import { ExportService } from "../services/export.service.js";
import { BatchAttendanceRequest } from "@absensi/shared/types";
import { createLogger } from "../utils/logger.js";
import {
  validateBatchRequest,
  validateDateFormat,
} from "../utils/validators.js";
import { getCurrentMonthYear } from "../utils/time.js";

const router: ExpressRouter = Router();
const logger = createLogger("AttendanceRoutes");

/**
 * Validation middleware for batch attendance
 * Validates RFID IDs and shift values have correct format
 */
const validateBatchAttendanceMiddleware = [
  body("batch")
    .isArray({ min: 1 })
    .withMessage("Batch must be a non-empty array"),
  body("batch.*.rfid_id")
    .trim()
    .notEmpty()
    .withMessage("RFID ID is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("RFID ID must be between 1 and 255 characters"),
  body("batch.*.shift")
    .trim()
    .isIn(["siang", "malam"])
    .withMessage("Shift must be either 'siang' or 'malam'"),
  body("date")
    .trim()
    .notEmpty()
    .withMessage("Date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD format"),
];

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
      error_code: "VALIDATION_ERROR",
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
 * POST /api/attendance/batch
 * Process batch of RFID attendance scans
 * Request body: { batch: Array<{rfid_id, shift}>, date: YYYY-MM-DD }
 * Response: { success, data: { processed, failed, errors } }
 */
router.post(
  "/batch",
  validateBatchAttendanceMiddleware,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as BatchAttendanceRequest;

      /**
       * Validate batch request using service-level validation
       */
      const batchValidation = validateBatchRequest(body.batch);
      if (batchValidation) {
        return res.status(400).json({
          success: false,
          error: batchValidation.message,
          error_code: batchValidation.code,
        });
      }

      /**
       * Validate date format
       */
      const dateValidation = validateDateFormat(body.date);
      if (dateValidation) {
        return res.status(400).json({
          success: false,
          error: dateValidation.message,
          error_code: dateValidation.code,
        });
      }

      /**
       * Process batch attendance records
       */
      const result = await AttendanceService.processBatch(body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error processing batch", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/today
 * Get today's attendance summary
 */
router.get(
  "/today",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await AttendanceService.getTodaySummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error("Error getting today summary", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/month
 * Get monthly attendance data with optional filters
 * Query params: month (0-11), year, school_type, class_id, shift
 */
router.get(
  "/month",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year, school_type, class_id, shift } = req.query;

      const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
      const queryMonth = month ? parseInt(month as string) : currentMonth;
      const queryYear = year ? parseInt(year as string) : currentYear;

      // Get attendance data
      const logs = await DatabaseService.getAttendanceWithFilters({
        month: queryMonth,
        year: queryYear,
        school_type: school_type as string,
        class_id: class_id as string,
        shift: shift as any,
      });

      // Transform for response
      const data = logs.map((log) => ({
        id: log.id,
        santri_id: log.santri_id,
        santri_name: (log.santri as any)?.name,
        class_name: (log.class as any)?.name,
        date: log.date,
        shift: log.shift,
        checked_in_at: log.checked_in_at,
        status: log.status,
      }));

      res.json({
        success: true,
        data: {
          month: queryMonth,
          year: queryYear,
          total_records: data.length,
          records: data,
        },
      });
    } catch (error) {
      logger.error("Error getting monthly attendance", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/available-months
 * Get months and years with available attendance data
 * Query params: shift (siang|malam)
 */
router.get(
  "/available-months",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shift } = req.query;

      // Validate shift parameter
      if (!shift || (shift !== "siang" && shift !== "malam")) {
        return res.status(400).json({
          success: false,
          error: "Shift is required (siang or malam)",
          error_code: "MISSING_SHIFT",
        });
      }

      const availableMonths = await DatabaseService.getAvailableMonths(
        shift as "siang" | "malam",
      );

      res.json({
        success: true,
        data: availableMonths,
      });
    } catch (error) {
      logger.error("Error getting available months", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/export
 * Export attendance data as JSON (attendance matrices)
 * Query params: month, year, shift (siang|malam), school_type, class_id
 */
router.get(
  "/export",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year, shift, school_type, class_id } = req.query;

      // Validate required params
      if (!shift || (shift !== "siang" && shift !== "malam")) {
        return res.status(400).json({
          success: false,
          error: "Shift is required (siang or malam)",
          error_code: "MISSING_SHIFT",
        });
      }

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          error: "Month and year are required",
          error_code: "MISSING_DATE",
        });
      }

      const queryMonth = parseInt(month as string);
      const queryYear = parseInt(year as string);

      if (queryMonth < 1 || queryMonth > 12 || queryYear < 2000) {
        return res.status(400).json({
          success: false,
          error: "Invalid month or year",
          error_code: "INVALID_DATE",
        });
      }

      // Get export data
      const exportData = await DatabaseService.getExportData(
        queryMonth,
        queryYear,
        shift as "siang" | "malam",
        school_type as string,
        class_id as string,
      );

      if (!exportData.classes || exportData.classes.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No classes found for the given criteria",
          error_code: "NO_DATA",
        });
      }

      // Get month name
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const monthName = monthNames[queryMonth - 1];

      // Get days in month
      const daysInMonth = new Date(queryYear, queryMonth, 0).getDate();

      // Build matrices for each class
      const classMatrices = [];
      for (const classItem of exportData.classes) {
        const santriInClass = exportData.santri.filter(
          (s: any) => s.class_id === classItem.id,
        );
        const classAttendance = exportData.attendance_logs.filter(
          (a: any) => a.class_id === classItem.id,
        );

        const matrix = ExportService.buildClassMatrix(
          classItem,
          santriInClass,
          classAttendance,
          daysInMonth,
          shift as "siang" | "malam",
        );

        classMatrices.push(matrix);
      }

      // Validate that there's actual attendance data
      if (exportData.attendance_logs.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Tidak ada data absensi untuk bulan ${monthName} ${queryYear} shift ${shift}`,
          error_code: "NO_ATTENDANCE_DATA",
        });
      }

      // Return JSON data
      res.json({
        success: true,
        data: {
          month: queryMonth,
          year: queryYear,
          monthName,
          shift,
          schoolType: school_type || "all",
          daysInMonth,
          classMatrices,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error exporting data", error);
      next(error);
    }
  },
);

export default router;
