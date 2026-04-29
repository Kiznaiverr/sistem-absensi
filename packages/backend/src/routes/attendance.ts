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
import {
  getCurrentMonthYear,
  getCurrentDateString,
  detectShift,
} from "../utils/time.js";

const router: ExpressRouter = Router();
const logger = createLogger("AttendanceRoutes");

/**
 * Validation middleware for batch attendance - conditional based on auth source
 * - API Key (ESP32): shift and date are completely optional (will be auto-detected)
 * - JWT (GUI): shift optional with auto-detect, date optional (defaults to today)
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
    .optional()
    .trim()
    .isIn(["siang", "malam"])
    .withMessage("Shift must be either 'siang' or 'malam'"),
  body("date")
    .optional()
    .trim()
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
 *
 * For API Key (ESP32): shift and date are optional, will be auto-detected
 * For JWT (GUI): shift and date can be provided or auto-detected
 *
 * Request body: { batch: Array<{rfid_id, shift?}>, date?: YYYY-MM-DD }
 * Response: { success, data: { processed, failed, errors } }
 */
router.post(
  "/batch",
  validateBatchAttendanceMiddleware,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let body = req.body as BatchAttendanceRequest;

      /**
       * Auto-detect date if not provided (use today)
       */
      if (!body.date) {
        body.date = getCurrentDateString();
        logger.debug("Date not provided, using today", { date: body.date });
      }

      /**
       * Auto-detect shift if not provided for any item in batch
       */
      if (body.batch && Array.isArray(body.batch)) {
        body.batch = body.batch.map((item: any) => {
          if (!item.shift) {
            const detectedShift = detectShift();
            if (!detectedShift) {
              // If shift cannot be detected (outside hours), we'll let the service handle it
              // and return OUTSIDE_HOURS error for consistency
              return item;
            }
            return { ...item, shift: detectedShift };
          }
          return item;
        });
      }

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
 * POST /api/attendance/refresh-cache
 * Refresh today's attendance cache from database
 */
router.post(
  "/refresh-cache",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await AttendanceService.refreshAttendanceTodayCache();

      res.json({
        success: true,
        message: "Attendance cache refreshed",
      });
    } catch (error) {
      logger.error("Error refreshing attendance cache", error);
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
 * GET /api/attendance/today/status
 * Check today's attendance status for individual santri.
 * Query params: santri_id OR rfid_id OR q (name/RFID text)
 */
router.get(
  "/today/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const santriId = (req.query.santri_id as string | undefined)?.trim();
      const rfidId = (req.query.rfid_id as string | undefined)?.trim();
      const queryText = (req.query.q as string | undefined)?.trim();

      if (!santriId && !rfidId && !queryText) {
        return res.status(400).json({
          success: false,
          error: "One of santri_id, rfid_id, or q is required",
          error_code: "MISSING_IDENTIFIER",
        });
      }

      let santri: any | null = null;

      if (santriId) {
        santri = await DatabaseService.getSantriById(santriId);
      } else if (rfidId) {
        santri = await DatabaseService.getSantriByRFID(rfidId);
      } else if (queryText) {
        // Prioritize exact RFID match when q is provided from tap-card flow.
        const exactByRfid = await DatabaseService.getSantriByRFID(queryText);
        if (exactByRfid) {
          santri = exactByRfid;
        } else {
          const candidates = await DatabaseService.searchSantriCandidates(
            queryText,
            20,
          );

          if (candidates.length === 0) {
            return res.status(404).json({
              success: false,
              error: "Santri tidak ditemukan",
              error_code: "SANTRI_NOT_FOUND",
            });
          }

          if (candidates.length > 1) {
            return res.json({
              success: true,
              data: {
                mode: "candidates",
                query: queryText,
                candidates: candidates.map((item: any) => ({
                  id: item.id,
                  name: item.name,
                  rfid_id: item.rfid_id,
                  class_id: item.class_id,
                  class_name: item.classes?.name || null,
                  school_type: item.classes?.school_type || null,
                  is_active: item.is_active,
                })),
              },
            });
          }

          santri = candidates[0];
        }
      }

      if (!santri) {
        return res.status(404).json({
          success: false,
          error: "Santri tidak ditemukan",
          error_code: "SANTRI_NOT_FOUND",
        });
      }

      const today = new Date().toISOString().split("T")[0];
      const status = await DatabaseService.getSantriAttendanceTodayStatus(
        santri.id,
        today,
      );

      res.json({
        success: true,
        data: {
          mode: "single",
          date: today,
          santri: {
            id: santri.id,
            name: santri.name,
            rfid_id: santri.rfid_id,
            class_id: santri.class_id,
            class_name: santri.classes?.name || null,
            school_type: santri.classes?.school_type || null,
            is_active: santri.is_active,
          },
          status,
        },
      });
    } catch (error) {
      logger.error("Error checking individual today status", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/today/class-summary
 * Get today's attendance summary grouped by class.
 */
router.get(
  "/today/class-summary",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const summary =
        await DatabaseService.getTodayClassAttendanceSummary(today);

      res.json({
        success: true,
        data: {
          date: today,
          classes: summary,
        },
      });
    } catch (error) {
      logger.error("Error getting today class summary", error);
      next(error);
    }
  },
);

/**
 * GET /api/attendance/today/class-status
 * Get today's attendance status detail for one class.
 * Query params: class_id
 */
router.get(
  "/today/class-status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const classId = (req.query.class_id as string | undefined)?.trim();

      if (!classId) {
        return res.status(400).json({
          success: false,
          error: "class_id is required",
          error_code: "MISSING_CLASS_ID",
        });
      }

      const today = new Date().toISOString().split("T")[0];
      const status = await DatabaseService.getTodayClassAttendanceStatus(
        classId,
        today,
      );

      if (!status) {
        return res.status(404).json({
          success: false,
          error: "Class not found",
          error_code: "CLASS_NOT_FOUND",
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error("Error getting today class status", error);
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
