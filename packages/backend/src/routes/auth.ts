/**
 * Auth Routes
 * POST /auth/login - Login with username/email and password
 * POST /auth/refresh - Refresh access token
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { AuthService } from "../services/auth.service.js";
import { DatabaseService } from "../services/database.service.js";
import { createLogger } from "../utils/logger.js";
import type { LoginRequest } from "@absensi/shared/types";

const router: ExpressRouter = Router();
const logger = createLogger("AuthRoutes");

/**
 * POST /auth/login
 * Login with username or email + password
 */
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginRequest;

      // Validate request
      if (!body.username_or_email || !body.password) {
        return res.status(400).json({
          success: false,
          error: "Username/email and password are required",
          error_code: "INVALID_LOGIN_REQUEST",
        });
      }

      // Find admin by email or username
      const admin = await DatabaseService.findAdminByEmailOrUsername(
        body.username_or_email,
      );

      if (!admin) {
        logger.warn(
          `Login attempt with non-existent username/email: ${body.username_or_email}`,
        );
        return res.status(401).json({
          success: false,
          error: "Invalid username/email or password",
          error_code: "INVALID_CREDENTIALS",
        });
      }

      // Check if admin is active
      if (!admin.is_active) {
        return res.status(401).json({
          success: false,
          error: "Admin account is inactive",
          error_code: "ADMIN_INACTIVE",
        });
      }

      // Verify password
      const passwordMatch = await AuthService.verifyPassword(
        body.password,
        admin.password_hash,
      );

      if (!passwordMatch) {
        logger.warn(`Failed login attempt for admin: ${admin.email}`);
        return res.status(401).json({
          success: false,
          error: "Invalid username/email or password",
          error_code: "INVALID_CREDENTIALS",
        });
      }

      // Generate tokens
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

      // Update last login
      await DatabaseService.updateAdminLastLogin(admin.id);

      logger.info(`Admin logged in: ${admin.email}`);

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
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600, // 1 hour in seconds
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
 * Refresh access token using refresh token
 */
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          error: "Refresh token is required",
          error_code: "MISSING_REFRESH_TOKEN",
        });
      }

      // Verify refresh token
      const decoded = AuthService.verifyToken(refresh_token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired refresh token",
          error_code: "INVALID_REFRESH_TOKEN",
        });
      }

      // Generate new access token
      const accessToken = AuthService.signAccessToken({
        admin_id: decoded.admin_id,
        email: decoded.email,
        username: decoded.username,
      });

      res.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 3600,
        },
      });
    } catch (error) {
      logger.error("Error refreshing token", error);
      next(error);
    }
  },
);

export default router;
