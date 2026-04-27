/**
 * Auth Middleware
 * Validates JWT tokens from HttpOnly cookies or Authorization header
 * Attaches admin info to request for downstream handlers
 */

import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { ApiKeyService } from "../services/apikey.service.js";
import { AuditService } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AuthMiddleware");

/**
 * Extend Express Request to include admin info and auth source
 */
declare global {
  namespace Express {
    interface Request {
      admin?: {
        admin_id: string;
        email: string;
        username: string;
      };
      auth_source?: "jwt" | "api_key";
    }
  }
}

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
 * Validate authorization: API Key OR JWT token
 * API Key takes precedence if API_KEY_ENABLED is true
 *
 * API Key: Header 'X-API-Key'
 * JWT: HttpOnly cookie (access_token) or Authorization header (Bearer token)
 */
export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Priority 1: Check API Key (for third-party apps)
    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey && ApiKeyService.isEnabled()) {
      if (ApiKeyService.validateApiKey(apiKey)) {
        req.auth_source = "api_key";
        logger.debug(
          `Request authenticated via API Key from ${getClientIp(req)}`,
        );
        return next();
      } else {
        const clientIp = getClientIp(req);
        const userAgent = getUserAgent(req);

        await AuditService.logInvalidToken(
          req.path,
          req.method,
          clientIp,
          userAgent,
          "Invalid API key",
        );

        res.status(401).json({
          success: false,
          error: "Invalid API key",
          error_code: "INVALID_API_KEY",
        });
        return;
      }
    }

    // Priority 2: Check JWT Token (for browser/GUI)
    let token: string | undefined;

    /**
     * Try to get token from HttpOnly cookie first (secure)
     */
    token = req.cookies?.access_token;

    /**
     * Fall back to Authorization header if no cookie
     * Format: Authorization: Bearer <token>
     */
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7); // Remove "Bearer "
      }
    }

    if (!token) {
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      /**
       * Audit log missing token
       */
      await AuditService.logInvalidToken(
        req.path,
        req.method,
        clientIp,
        userAgent,
        "No token provided",
      );

      res.status(401).json({
        success: false,
        error: "Missing or invalid authorization token",
        error_code: "MISSING_TOKEN",
      });
      return;
    }

    /**
     * Verify token signature, expiry, and validity
     */
    const decoded = AuthService.verifyToken(token);

    if (!decoded) {
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      /**
       * Audit log invalid token
       */
      await AuditService.logInvalidToken(
        req.path,
        req.method,
        clientIp,
        userAgent,
        "Invalid or expired token",
      );

      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        error_code: "INVALID_TOKEN",
      });
      return;
    }

    /**
     * Attach admin info to request for downstream handlers
     */
    req.admin = {
      admin_id: decoded.admin_id,
      email: decoded.email,
      username: decoded.username,
    };
    req.auth_source = "jwt";

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
