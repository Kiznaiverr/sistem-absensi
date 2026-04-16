/**
 * Auth Routes
 * POST /auth/login - Login with username/email and password
 * POST /auth/refresh - Refresh access token
 * POST /auth/logout - Clear authentication cookies
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { AuthService } from "../services/auth.service.js";
import { DatabaseService } from "../services/database.service.js";
import { AuditService } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";
import {
  validateLogin,
  validateRefreshToken,
  handleValidationErrors,
} from "../middleware/validation.middleware.js";
import type { LoginRequest } from "@absensi/shared/types";

const router: ExpressRouter = Router();
const logger = createLogger("AuthRoutes");

/**
 * Helper function to get client IP address
 * Considers X-Forwarded-For header for proxied requests
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
 * POST /auth/login
 * Authenticate admin with username/email and password
 * Sets HttpOnly cookies for secure token storage
 * Request body: { username_or_email: string, password: string }
 * Response: { success, admin info } + Set-Cookie headers
 */
router.post(
  "/login",
  validateLogin,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginRequest;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      /**
       * Find admin by email or username
       */
      const admin = await DatabaseService.findAdminByEmailOrUsername(
        body.username_or_email,
      );

      if (!admin) {
        logger.warn(
          `Login attempt with non-existent username/email: ${body.username_or_email}`,
        );

        /**
         * Audit log failed login
         */
        await AuditService.logLoginFailed(
          body.username_or_email,
          clientIp,
          userAgent,
          "User not found",
        );

        return res.status(401).json({
          success: false,
          error: "Invalid username/email or password",
          error_code: "INVALID_CREDENTIALS",
        });
      }

      /**
       * Check if admin account is active
       */
      if (!admin.is_active) {
        logger.warn(`Login attempt on inactive account: ${admin.email}`);

        /**
         * Audit log inactive account login attempt
         */
        await AuditService.logLoginInactiveAccount(
          admin.email,
          clientIp,
          userAgent,
        );

        return res.status(401).json({
          success: false,
          error: "Admin account is inactive",
          error_code: "ADMIN_INACTIVE",
        });
      }

      /**
       * Verify password against stored hash
       */
      const passwordMatch = await AuthService.verifyPassword(
        body.password,
        admin.password_hash,
      );

      if (!passwordMatch) {
        logger.warn(`Failed login attempt for admin: ${admin.email}`);

        /**
         * Audit log failed password attempt
         */
        await AuditService.logLoginFailed(
          admin.email,
          clientIp,
          userAgent,
          "Invalid password",
        );

        return res.status(401).json({
          success: false,
          error: "Invalid username/email or password",
          error_code: "INVALID_CREDENTIALS",
        });
      }

      /**
       * Generate access and refresh tokens
       */
      const accessToken = AuthService.signAccessToken({
        admin_id: admin.id,
        email: admin.email,
        username: admin.username,
      });

      const refreshToken = AuthService.signRefreshToken({
        admin_id: admin.id,
        email: admin.email,
        username: admin.username,
      });

      /**
       * Update last login timestamp
       */
      await DatabaseService.updateAdminLastLogin(admin.id);

      /**
       * Audit log successful login
       */
      await AuditService.logLoginSuccess(
        admin.id,
        admin.email,
        admin.username,
        clientIp,
        userAgent,
      );

      logger.info(`Admin logged in: ${admin.email}`);

      /**
       * Set HttpOnly cookies for secure token storage
       * HttpOnly: Cannot be accessed via JavaScript (XSS protection)
       * Secure: Only sent over HTTPS (MITM protection)
       * SameSite=Strict: Only sent in same-site requests (CSRF protection)
       */
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 43200 * 1000, // 12 hours in milliseconds
        path: "/",
      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 604800 * 1000, // 7 days in milliseconds
        path: "/",
      });

      res.json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            email: admin.email,
            username: admin.username,
            is_active: admin.is_active,
            created_at: admin.created_at,
          },
        },
      });
    } catch (error) {
      logger.error("Error during login", error);
      next(error);
    }
  },
);

/**
 * POST /auth/refresh
 * Refresh access token using valid refresh token from HttpOnly cookie
 * No request body needed - token is read from secure cookie
 * Sets new access_token cookie
 * Response: { success, admin info }
 */
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      /**
       * Get refresh token from HttpOnly cookie
       */
      const refresh_token = req.cookies?.refresh_token;
      const clientIp = getClientIp(req);
      const userAgent = getUserAgent(req);

      if (!refresh_token) {
        /**
         * Audit log missing refresh token
         */
        await AuditService.logTokenRefreshFailed(
          clientIp,
          userAgent,
          "No refresh token",
        );

        return res.status(401).json({
          success: false,
          error: "Refresh token is required",
          error_code: "MISSING_REFRESH_TOKEN",
        });
      }

      /**
       * Verify refresh token validity and expiry
       */
      const decoded = AuthService.verifyToken(refresh_token);

      if (!decoded) {
        logger.warn("Refresh token verification failed");

        /**
         * Audit log invalid refresh token
         */
        await AuditService.logTokenRefreshFailed(
          clientIp,
          userAgent,
          "Invalid or expired token",
        );

        return res.status(401).json({
          success: false,
          error: "Invalid or expired refresh token",
          error_code: "INVALID_REFRESH_TOKEN",
        });
      }

      /**
       * Generate new access token with same admin context
       */
      const accessToken = AuthService.signAccessToken({
        admin_id: decoded.admin_id,
        email: decoded.email,
        username: decoded.username,
      });

      /**
       * Audit log successful token refresh
       */
      await AuditService.logTokenRefresh(
        decoded.admin_id,
        decoded.email,
        clientIp,
        userAgent,
      );

      logger.info(`Token refreshed for admin: ${decoded.email}`);

      /**
       * Set new access token in HttpOnly cookie
       */
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 43200 * 1000, // 12 hours in milliseconds
        path: "/",
      });

      res.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 43200, // 12 hours in seconds
          admin: {
            id: decoded.admin_id,
            email: decoded.email,
          },
        },
      });
    } catch (error) {
      logger.error("Error refreshing token", error);
      next(error);
    }
  },
);

/**
 * POST /auth/logout
 * Clear authentication cookies
 * Response: { success }
 */
router.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      /**
       * Clear authentication cookies
       */
      res.clearCookie("access_token", { path: "/" });
      res.clearCookie("refresh_token", { path: "/" });

      logger.info("Admin logged out");

      res.json({
        success: true,
        data: {
          message: "Logged out successfully",
        },
      });
    } catch (error) {
      logger.error("Error during logout", error);
      next(error);
    }
  },
);

export default router;
