/**
 * Auth Middleware
 * Validates JWT tokens and extracts admin info
 */

import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AuthMiddleware");

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: {
        admin_id: string;
        email: string;
        username: string;
      };
    }
  }
}

/**
 * Validate JWT token from Authorization header
 * Header format: Authorization: Bearer <token>
 */
export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
        error_code: "MISSING_TOKEN",
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer "
    const decoded = AuthService.verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        error_code: "INVALID_TOKEN",
      });
      return;
    }

    // Attach admin info to request
    req.admin = {
      admin_id: decoded.admin_id,
      email: decoded.email,
      username: decoded.username,
    };

    next();
  } catch (error) {
    logger.error("Error validating token", error);
    res.status(401).json({
      success: false,
      error: "Token validation failed",
      error_code: "TOKEN_VALIDATION_ERROR",
    });
  }
}
