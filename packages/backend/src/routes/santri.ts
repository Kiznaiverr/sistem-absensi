/**
 * Santri Management Routes
 * POST /api/santri - Add new santri
 * GET /api/santri - Get all santri with filters
 * GET /api/santri/template - Download import template
 * POST /api/santri/import-jobs - Queue bulk import santri from Excel
 * GET /api/santri/import-jobs/:jobId - Get import job status
 * GET /api/santri/import-jobs/:jobId/errors - Get import error rows
 * GET /api/santri/import-jobs/:jobId/progress - SSE progress
 * GET /api/santri/import-jobs/:jobId/errors/export - Export import errors
 * GET /api/santri/:santriId - Get santri by ID
 * PUT /api/santri/:santriId - Update santri
 * PATCH /api/santri/:santriId/rfid - Update santri RFID
 * DELETE /api/santri/:santriId - Soft delete santri
 *
 * All routes require valid JWT token (validateToken middleware)
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import multer from "multer";
import { cacheService } from "../services/cache.service.js";
import { DatabaseService } from "../services/database.service.js";
import { SantriImportJobService } from "../services/santri-import-job.service.js";
import { SantriTemplateService } from "../services/santri-template.service.js";
import { AuditService } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";
import {
  validateCreateSantri,
  validateUpdateSantri,
  validateUpdateRFID,
  handleValidationErrors,
} from "../middleware/validation.middleware.js";

// Extend Express Request to include file from multer
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

const router: ExpressRouter = Router();
const logger = createLogger("SantriRoutes");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    // Accept only Excel files
    const excelMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (excelMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Berkas harus format Excel (.xlsx atau .xls)"));
    }
  },
});

/**
 * Helper function to get client IP address
 */
function getClientIp(req: Request): string | undefined {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress
  );
}

/**
 * Helper function to get user agent
 */
function getUserAgent(req: Request): string | undefined {
  return req.headers["user-agent"];
}

function isJobOwnedByCurrentAdmin(
  req: Request,
  createdBy: string | null,
): boolean {
  const currentAdminId = (req as any).user?.admin_id;
  if (!createdBy) return true;
  return currentAdminId === createdBy;
}

function invalidateSantriClassCache(): void {
  const deletedKeys = cacheService.deleteByPrefix("santri:class:");
  logger.info("Invalidated santri class cache", { deleted_keys: deletedKeys });
}

/**
 * POST /api/santri
 * Add new santri (Admin only)
 */
router.post(
  "/",
  validateCreateSantri,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, rfid_id, class_id } = req.body;
      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Check if class exists
      const classes = await DatabaseService.getClasses();
      const classExists = classes.some((c) => c.id === class_id);

      if (!classExists) {
        return res.status(400).json({
          success: false,
          error: "Class not found",
          error_code: "CLASS_NOT_FOUND",
        });
      }

      // Check if RFID already exists
      const rfidExists = await DatabaseService.checkRFIDExists(rfid_id);

      if (rfidExists) {
        logger.warn(
          `Attempted to create santri with duplicate RFID: ${rfid_id}`,
        );
        return res.status(409).json({
          success: false,
          error: "RFID ID already exists",
          error_code: "RFID_ALREADY_EXISTS",
        });
      }

      // Create santri
      const santri = await DatabaseService.createSantri(
        name,
        rfid_id,
        class_id,
      );

      // Audit log
      await AuditService.log("SANTRI_CREATED", {
        admin_id: adminId,
        admin_email: adminEmail,
        santri_id: santri.id,
        santri_name: santri.name,
        rfid_id: santri.rfid_id,
        class_id: santri.class_id,
        ip: clientIp,
        user_agent: userAgent,
      });

      logger.info(`Santri created: ${santri.name} (${santri.rfid_id})`);
      invalidateSantriClassCache();

      res.status(201).json({
        success: true,
        data: santri,
      });
    } catch (error) {
      logger.error("Error creating santri", error);
      next(error);
    }
  },
);

/**
 * GET /api/santri
 * Get all santri with optional filters
 * Query params: class_id, search, is_active
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.query.class_id as string | undefined;
    const search = req.query.search as string | undefined;
    const isActive = req.query.is_active
      ? req.query.is_active === "true"
      : undefined;

    const santriList = await DatabaseService.getAllSantri({
      classId,
      search,
      isActive,
    });

    // Avoid stale admin data after import/edit/delete.
    res.set("Cache-Control", "private, no-store, max-age=0");

    res.json({
      success: true,
      data: santriList,
      total: santriList.length,
    });
  } catch (error) {
    logger.error("Error getting santri list", error);
    next(error);
  }
});

/**
 * GET /api/santri/template
 * Download Excel template for bulk import
 */
router.get(
  "/template",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateBuffer = await SantriTemplateService.generateTemplate();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="template_santri.xlsx"',
      );
      res.setHeader("Content-Length", templateBuffer.byteLength);

      res.send(Buffer.from(templateBuffer));
    } catch (error) {
      logger.error("Error generating template", error);
      next(error);
    }
  },
);

/**
 * POST /api/santri/import-jobs
 * Create import job and process in background worker
 */
router.post(
  "/import-jobs",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Berkas tidak ditemukan",
          error_code: "NO_FILE_UPLOADED",
        });
      }

      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;

      const job = await SantriImportJobService.createQueuedJob({
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname,
        adminId,
        adminEmail,
      });

      logger.info("Import job queued", {
        jobId: job.id,
        adminEmail,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });

      res.status(202).json({
        success: true,
        data: {
          job_id: job.id,
          status: job.status,
          progress_percent: job.progress_percent,
          created_at: job.created_at,
          expires_at: job.expires_at,
        },
      });
    } catch (error: any) {
      if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Berkas terlalu besar (max 25MB)",
          error_code: "FILE_TOO_LARGE",
        });
      }

      if (error?.message?.includes("format Excel")) {
        return res.status(400).json({
          success: false,
          error: "Berkas harus format Excel (.xlsx atau .xls)",
          error_code: "INVALID_FILE_FORMAT",
        });
      }

      next(error);
    }
  },
);

/**
 * GET /api/santri/import-jobs/:jobId
 * Get import job status and summary
 */
router.get(
  "/import-jobs/:jobId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const job = await SantriImportJobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: "Job tidak ditemukan",
          error_code: "JOB_NOT_FOUND",
        });
      }

      if (!isJobOwnedByCurrentAdmin(req, job.created_by)) {
        return res.status(403).json({
          success: false,
          error: "Akses ditolak",
          error_code: "FORBIDDEN",
        });
      }

      res.json({
        success: true,
        data: {
          job_id: job.id,
          status: job.status,
          stage: job.stage,
          message: job.message,
          progress_percent: job.progress_percent,
          total_rows: job.total_rows,
          processed_rows: job.processed_rows,
          success_count: job.success_count,
          error_count: job.error_count,
          created_at: job.created_at,
          started_at: job.started_at,
          finished_at: job.finished_at,
          expires_at: job.expires_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/santri/import-jobs/:jobId/errors
 * Get import row-level errors
 */
router.get(
  "/import-jobs/:jobId/errors",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const job = await SantriImportJobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: "Job tidak ditemukan",
          error_code: "JOB_NOT_FOUND",
        });
      }

      if (!isJobOwnedByCurrentAdmin(req, job.created_by)) {
        return res.status(403).json({
          success: false,
          error: "Akses ditolak",
          error_code: "FORBIDDEN",
        });
      }

      const errors = await DatabaseService.getSantriImportJobErrors(jobId);

      res.json({
        success: true,
        data: errors.map((err) => ({
          row: err.row_number,
          data: {
            name: err.name,
            rfid_id: err.rfid_id,
            class_name: err.class_name,
          },
          error_type: err.error_type,
          message: err.message,
          severity: err.severity,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/santri/import-jobs/:jobId/progress
 * SSE endpoint for import job progress
 */
router.get(
  "/import-jobs/:jobId/progress",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.setTimeout(0);
      res.setTimeout(0);

      const { jobId } = req.params;
      const job = await SantriImportJobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: "Job tidak ditemukan",
          error_code: "JOB_NOT_FOUND",
        });
      }

      if (!isJobOwnedByCurrentAdmin(req, job.created_by)) {
        return res.status(403).json({
          success: false,
          error: "Akses ditolak",
          error_code: "FORBIDDEN",
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let lastFingerprint = "";

      const sendEvent = async () => {
        const current = await SantriImportJobService.getJob(jobId);
        if (!current) {
          res.write(
            `data: ${JSON.stringify({ stage: "error", message: "Job tidak ditemukan" })}\n\n`,
          );
          res.end();
          return true;
        }

        const fingerprint = `${current.status}|${current.stage}|${current.progress_percent}|${current.processed_rows}|${current.error_count}`;
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          res.write(
            `data: ${JSON.stringify({
              job_id: current.id,
              stage: current.stage,
              status: current.status,
              percentage: current.progress_percent,
              current: current.processed_rows,
              total: current.total_rows,
              message: current.message,
              success_count: current.success_count,
              error_count: current.error_count,
            })}\n\n`,
          );
        }

        if (current.status === "completed" || current.status === "failed") {
          res.write(`data: ${JSON.stringify({ type: "closed" })}\n\n`);
          res.end();
          return true;
        }

        return false;
      };

      const isClosed = await sendEvent();
      if (isClosed) return;

      const timer = setInterval(() => {
        void sendEvent();
      }, 1000);

      req.on("close", () => {
        clearInterval(timer);
        res.end();
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/santri/import-jobs/:jobId/errors/export
 * Export import errors as Excel
 */
router.get(
  "/import-jobs/:jobId/errors/export",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const job = await SantriImportJobService.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: "Job tidak ditemukan",
          error_code: "JOB_NOT_FOUND",
        });
      }

      if (!isJobOwnedByCurrentAdmin(req, job.created_by)) {
        return res.status(403).json({
          success: false,
          error: "Akses ditolak",
          error_code: "FORBIDDEN",
        });
      }

      const fileBuffer =
        await SantriImportJobService.exportJobErrorsExcel(jobId);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="import-errors-${jobId}.xlsx"`,
      );
      res.setHeader("Content-Length", fileBuffer.byteLength);

      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/santri/:santriId
 * Get santri by ID
 */
router.get(
  "/:santriId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { santriId } = req.params;

      const santri = await DatabaseService.getSantriById(santriId);

      if (!santri) {
        return res.status(404).json({
          success: false,
          error: "Santri not found",
          error_code: "SANTRI_NOT_FOUND",
        });
      }

      res.set("Cache-Control", "public, max-age=300"); // 5 minutes cache for individual santri
      res.json({
        success: true,
        data: santri,
      });
    } catch (error) {
      logger.error("Error getting santri by ID", {
        santriId: req.params.santriId,
        error,
      });
      next(error);
    }
  },
);

/**
 * PUT /api/santri/:santriId
 * Update santri (Admin only)
 */
router.put(
  "/:santriId",
  validateUpdateSantri,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { santriId } = req.params;
      const { name, class_id, is_active } = req.body;
      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Check if santri exists
      const existingSantri = await DatabaseService.getSantriById(santriId);

      if (!existingSantri) {
        return res.status(404).json({
          success: false,
          error: "Santri not found",
          error_code: "SANTRI_NOT_FOUND",
        });
      }

      // If class_id provided, verify it exists
      if (class_id) {
        const classes = await DatabaseService.getClasses();
        const classExists = classes.some((c) => c.id === class_id);

        if (!classExists) {
          return res.status(400).json({
            success: false,
            error: "Class not found",
            error_code: "CLASS_NOT_FOUND",
          });
        }
      }

      // Update santri
      const updatedSantri = await DatabaseService.updateSantri(santriId, {
        name,
        classId: class_id,
        isActive: is_active,
      });

      // Audit log
      await AuditService.log("SANTRI_UPDATED", {
        admin_id: adminId,
        admin_email: adminEmail,
        santri_id: santriId,
        santri_name: updatedSantri.name,
        changes: {
          name: name ? `${existingSantri.name} -> ${name}` : undefined,
          class_id: class_id
            ? `${existingSantri.class_id} -> ${class_id}`
            : undefined,
          is_active:
            is_active !== undefined
              ? `${existingSantri.is_active} -> ${is_active}`
              : undefined,
        },
        ip: clientIp,
        user_agent: userAgent,
      });

      logger.info(`Santri updated: ${updatedSantri.name}`);
      invalidateSantriClassCache();

      res.json({
        success: true,
        data: updatedSantri,
      });
    } catch (error) {
      logger.error("Error updating santri", {
        santriId: req.params.santriId,
        error,
      });
      next(error);
    }
  },
);

/**
 * PATCH /api/santri/:santriId/rfid
 * Update santri RFID (Admin only)
 */
router.patch(
  "/:santriId/rfid",
  validateUpdateRFID,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { santriId } = req.params;
      const { rfid_id } = req.body;
      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Check if santri exists
      const existingSantri = await DatabaseService.getSantriById(santriId);

      if (!existingSantri) {
        return res.status(404).json({
          success: false,
          error: "Santri not found",
          error_code: "SANTRI_NOT_FOUND",
        });
      }

      // Check if new RFID already exists (exclude current santri)
      const rfidExists = await DatabaseService.checkRFIDExists(
        rfid_id,
        santriId,
      );

      if (rfidExists) {
        logger.warn(`Attempted to update RFID with duplicate: ${rfid_id}`);
        return res.status(409).json({
          success: false,
          error: "RFID ID already in use by another santri",
          error_code: "RFID_ALREADY_EXISTS",
        });
      }

      // Update RFID
      const updatedSantri = await DatabaseService.updateSantriRFID(
        santriId,
        rfid_id,
      );

      // Audit log
      await AuditService.log("SANTRI_RFID_UPDATED", {
        admin_id: adminId,
        admin_email: adminEmail,
        santri_id: santriId,
        santri_name: updatedSantri.name,
        old_rfid_id: existingSantri.rfid_id,
        new_rfid_id: rfid_id,
        ip: clientIp,
        user_agent: userAgent,
      });

      logger.info(
        `Santri RFID updated: ${existingSantri.rfid_id} -> ${rfid_id}`,
      );
      invalidateSantriClassCache();

      res.json({
        success: true,
        data: updatedSantri,
      });
    } catch (error) {
      logger.error("Error updating santri RFID", {
        santriId: req.params.santriId,
        error,
      });
      next(error);
    }
  },
);

/**
 * DELETE /api/santri/:santriId
 * Soft delete santri (Admin only)
 */
router.delete(
  "/:santriId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { santriId } = req.params;
      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      // Check if santri exists
      const existingSantri = await DatabaseService.getSantriById(santriId);

      if (!existingSantri) {
        return res.status(404).json({
          success: false,
          error: "Santri not found",
          error_code: "SANTRI_NOT_FOUND",
        });
      }

      // Soft delete santri
      const deletedSantri = await DatabaseService.deleteSantri(santriId);

      // Audit log
      await AuditService.log("SANTRI_DELETED", {
        admin_id: adminId,
        admin_email: adminEmail,
        santri_id: santriId,
        santri_name: deletedSantri.name,
        rfid_id: deletedSantri.rfid_id,
        class_id: deletedSantri.class_id,
        ip: clientIp,
        user_agent: userAgent,
      });

      logger.info(`Santri deleted (soft): ${deletedSantri.name}`);
      invalidateSantriClassCache();

      res.json({
        success: true,
        data: {
          message: "Santri deleted successfully",
          santri_id: santriId,
        },
      });
    } catch (error) {
      logger.error("Error deleting santri", {
        santriId: req.params.santriId,
        error,
      });
      next(error);
    }
  },
);

export default router;
