/**
 * ESP32 Error Routes
 * Handles error submission and retrieval for ESP32 devices
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { body, query, validationResult } from "express-validator";
import { Esp32ErrorService } from "../services/esp32-error.service.js";
import { createLogger } from "../utils/logger.js";

const router: ExpressRouter = Router();
const logger = createLogger("Esp32ErrorRoutes");

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

const requireApiKeyForWrite = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.auth_source !== "api_key") {
    res.status(403).json({
      success: false,
      error: "ESP32 error submission requires API key authentication",
      error_code: "FORBIDDEN",
    });
    return;
  }

  next();
};

/**
 * POST /api/error/esp32
 * Submit error from ESP32 device
 * Body: { device_id, error_code, error_message, timestamp?, metadata? }
 */
router.post(
  "/",
  [
    body("device_id").trim().notEmpty().withMessage("device_id is required"),
    body("error_code").trim().notEmpty().withMessage("error_code is required"),
    body("error_message")
      .trim()
      .notEmpty()
      .withMessage("error_message is required"),
    body("timestamp")
      .optional()
      .isInt({ min: 1 })
      .withMessage("timestamp must be a valid unix timestamp")
      .toInt(),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("metadata must be an object"),
  ],
  handleValidationErrors,
  requireApiKeyForWrite,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { device_id, error_code, error_message, timestamp, metadata } =
        req.body;

      await Esp32ErrorService.logError({
        device_id: String(device_id).trim(),
        error_code: String(error_code).trim(),
        error_message: String(error_message).trim(),
        timestamp,
        metadata: metadata || null,
      });

      res.status(201).json({
        success: true,
        message: "ESP32 error logged successfully",
      });
    } catch (error) {
      logger.error("Error logging ESP32 error", error);
      next(error);
    }
  },
);

/**
 * GET /api/error/esp32
 * Retrieve ESP32 error logs
 * Query params: limit, offset, device_id, error_code, date, request_date
 * device_id can be set to 'all' to return all devices
 */
router.get(
  "/",
  [
    query("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
    query("offset").optional().isInt({ min: 0 }).toInt(),
    query("device_id").optional().isString().trim(),
    query("error_code").optional().isString().trim(),
    query("date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/),
    query("request_date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = (req.query.date as string) || undefined;
      const errors = await Esp32ErrorService.getErrors({
        limit: (req.query.limit as any) || 50,
        offset: (req.query.offset as any) || 0,
        device_id: (req.query.device_id as string) || undefined,
        error_code: (req.query.error_code as string) || undefined,
        date,
        request_date: (req.query.request_date as string) || undefined,
      });

      res.json({
        success: true,
        data: errors,
      });
    } catch (error) {
      logger.error("Error getting ESP32 error logs", error);
      next(error);
    }
  },
);

export default router;
