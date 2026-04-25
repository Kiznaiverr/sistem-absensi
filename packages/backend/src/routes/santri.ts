/**
 * Santri Management Routes
 * POST /api/santri - Add new santri
 * GET /api/santri - Get all santri with filters
 * GET /api/santri/template - Download import template
 * POST /api/santri/import - Bulk import santri from Excel
 * GET /api/santri/:santriId - Get santri by ID
 * PUT /api/santri/:santriId - Update santri
 * PATCH /api/santri/:santriId/rfid - Update santri RFID
 * DELETE /api/santri/:santriId - Soft delete santri
 *
 * All routes require valid JWT token (validateToken middleware)
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import multer, { MulterError } from "multer";
import { DatabaseService } from "../services/database.service.js";
import { SantriImportService } from "../services/santri-import.service.js";
import { SantriTemplateService } from "../services/santri-template.service.js";
import { ImportProgressService } from "../services/import-progress.service.js";
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

    // Only cache if no filters (all santri)
    if (!classId && !search && isActive === undefined) {
      res.set("Cache-Control", "public, max-age=300"); // 5 minutes cache for all santri
    }

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
 * GET /api/santri/import-progress/:sessionId
 * Server-Sent Events (SSE) endpoint for real-time import progress
 */
router.get(
  "/import-progress/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    // Disable timeout for SSE connection (long-lived)
    req.setTimeout(0);
    res.setTimeout(0);

    const { sessionId } = req.params;

    // Validate session exists
    if (!ImportProgressService.hasSession(sessionId)) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
        error_code: "SESSION_NOT_FOUND",
      });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`);

    // Send existing events
    const session = ImportProgressService.getSession(sessionId);
    if (session) {
      for (const event of session.events) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }

    // Keep connection open and send new events as they arrive
    const interval = setInterval(() => {
      const lastEvent = ImportProgressService.getLastEvent(sessionId);
      if (lastEvent) {
        res.write(`data: ${JSON.stringify(lastEvent)}\n\n`);
      }

      // Close if import is complete or error
      const sess = ImportProgressService.getSession(sessionId);
      if (sess?.isComplete) {
        clearInterval(interval);
        res.write(`data: ${JSON.stringify({ type: "closed" })}\n\n`);
        res.end();
      }
    }, 100); // Check every 100ms

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });
  },
);

/**
 * POST /api/santri/import
 * Import santri from Excel file (Admin only)
 */
router.post(
  "/import",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Berkas tidak ditemukan",
          error_code: "NO_FILE_UPLOADED",
        });
      }

      const sessionId = req.query.sessionId as string | undefined;
      const adminId = (req as any).user?.admin_id;
      const adminEmail = (req as any).user?.email;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      logger.info(`Starting import for admin: ${adminEmail}`, {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        sessionId,
      });

      // Create progress session if provided
      if (sessionId) {
        ImportProgressService.createSession(sessionId);
      }

      // Process import with progress tracking
      const result = await SantriImportService.importFromExcel(
        req.file.buffer,
        adminId,
        adminEmail,
        sessionId
          ? (event) => ImportProgressService.addEvent(sessionId, event)
          : undefined,
      );

      // Audit log for successful import
      if (result.summary.imported > 0) {
        await AuditService.log("SANTRI_BULK_IMPORT", {
          admin_id: adminId,
          admin_email: adminEmail,
          total_rows: result.summary.total_rows,
          imported_count: result.summary.imported,
          skipped_count: result.summary.skipped,
          file_name: req.file.originalname,
          file_size: req.file.size,
          error_count: result.errors.length,
          ip: clientIp,
          user_agent: userAgent,
        });
      }

      logger.info(`Import completed`, {
        total: result.summary.total_rows,
        imported: result.summary.imported,
        skipped: result.summary.skipped,
      });

      res.json(result);
    } catch (error: any) {
      logger.error("Error importing santri", error);

      // Handle specific multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Berkas terlalu besar (max 25MB)",
          error_code: "FILE_TOO_LARGE",
        });
      }

      if (error.message.includes("format Excel")) {
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
