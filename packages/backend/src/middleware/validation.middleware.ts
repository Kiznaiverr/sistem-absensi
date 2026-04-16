/**
 * Input Validation Middleware
 * Validates and sanitizes all incoming request data
 */

import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

/**
 * Validate login request
 * Checks username/email and password format
 */
export const validateLogin = [
  body("username_or_email")
    .trim()
    .notEmpty()
    .withMessage("Username or email is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Username/email must be between 3 and 255 characters"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

/**
 * Validate refresh token request
 * Checks refresh token is provided
 */
export const validateRefreshToken = [
  body("refresh_token")
    .trim()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

/**
 * Validate batch attendance request
 * Checks RFID IDs format and shift value
 */
export const validateBatchAttendance = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("Items must be a non-empty array"),
  body("items.*.rfid_id")
    .trim()
    .notEmpty()
    .withMessage("RFID ID is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("RFID ID must be between 1 and 255 characters"),
  body("items.*.shift")
    .trim()
    .isIn(["siang", "malam"])
    .withMessage("Shift must be either 'siang' or 'malam'"),
];

/**
 * Error handling middleware for validation
 * Returns validation errors to client
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: any) => ({
      field: error.param,
      message: error.msg,
      value: error.value,
    }));

    res.status(400).json({
      success: false,
      error: "Validation failed",
      error_code: "VALIDATION_ERROR",
      errors: formattedErrors,
    });
    return;
  }
  next();
};

/**
 * Sanitize numeric UUID strings
 * Ensures class_id and santri_id are valid
 */
export const validateUUID = (value: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Validate email format
 */
export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate RFID ID format
 * Can be alphanumeric with hyphens
 */
export const validateRFIDFormat = (rfid: string): boolean => {
  const rfidRegex = /^[a-zA-Z0-9-]{1,255}$/;
  return rfidRegex.test(rfid);
};
