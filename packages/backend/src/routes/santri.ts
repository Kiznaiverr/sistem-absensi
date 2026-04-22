/**
 * Santri Management Routes
 * POST /api/santri - Add new santri
 * GET /api/santri - Get all santri with filters
 * GET /api/santri/:santriId - Get santri by ID
 * PUT /api/santri/:santriId - Update santri
 * PATCH /api/santri/:santriId/rfid - Update santri RFID
 * DELETE /api/santri/:santriId - Soft delete santri
 *
 * All routes require valid JWT token (validateToken middleware)
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { DatabaseService } from "../services/database.service.js";
import { AuditService } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";
import {
  validateCreateSantri,
  validateUpdateSantri,
  validateUpdateRFID,
  handleValidationErrors,
} from "../middleware/validation.middleware.js";

const router: ExpressRouter = Router();
const logger = createLogger("SantriRoutes");

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
