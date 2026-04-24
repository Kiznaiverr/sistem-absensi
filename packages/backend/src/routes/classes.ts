/**
 * Classes Routes
 * GET /api/classes - Get all classes
 * GET /api/classes/:classId/santri - Get santri by class
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { cacheService } from "../services/cache.service.js";
import { DatabaseService } from "../services/database.service.js";
import { createLogger } from "../utils/logger.js";
import env from "../config/env.js";

const router: ExpressRouter = Router();
const logger = createLogger("ClassesRoutes");

/**
 * GET /api/classes
 * Get all classes
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let classes = null;

    // Try cache first
    if (env.CACHE_ENABLED) {
      classes = cacheService.get("classes:all");
    }

    // Fall back to database
    if (!classes) {
      classes = await DatabaseService.getClasses();
      if (env.CACHE_ENABLED) {
        cacheService.set("classes:all", classes, env.CACHE_TTL_SANTRI);
      }
    }

    res.set("Cache-Control", "public, max-age=3600"); // 1 hour cache for classes
    res.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    logger.error("Error getting classes", error);
    next(error);
  }
});

/**
 * GET /api/classes/:classId/santri
 * Get santri by class ID
 */
router.get(
  "/:classId/santri",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;

      let santri = null;
      const cacheKey = `santri:class:${classId}`;

      // Try cache first
      if (env.CACHE_ENABLED) {
        santri = cacheService.get(cacheKey);
      }

      // Fall back to database
      if (!santri) {
        santri = await DatabaseService.getSantriByClass(classId);
        if (env.CACHE_ENABLED) {
          cacheService.set(cacheKey, santri, env.CACHE_TTL_SANTRI);
        }
      }

      res.set("Cache-Control", "public, max-age=300"); // 5 minutes cache for santri by class
      res.json({
        success: true,
        data: santri,
      });
    } catch (error) {
      logger.error("Error getting santri by class", {
        classId: req.params.classId,
        error,
      });
      next(error);
    }
  },
);

/**
 * GET /api/classes/init-cache
 * Initialize or refresh cache
 * (Internal endpoint for debugging)
 */
router.post(
  "/init-cache",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear and reinitialize cache
      cacheService.clear();

      const classes = await DatabaseService.getClasses();
      cacheService.set("classes:all", classes, env.CACHE_TTL_SANTRI);

      for (const classItem of classes) {
        const santri = await DatabaseService.getSantriByClass(classItem.id);
        cacheService.set(
          `santri:class:${classItem.id}`,
          santri,
          env.CACHE_TTL_SANTRI,
        );
      }

      const stats = cacheService.getStats();
      logger.info("Cache reinitialized", stats);

      res.json({
        success: true,
        message: "Cache reinitialized",
        stats,
      });
    } catch (error) {
      logger.error("Error reinitializing cache", error);
      next(error);
    }
  },
);

export default router;
