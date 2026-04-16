/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP requests to HTTPS in production
 * Adds security headers for HTTPS connections
 */

import { Request, Response, NextFunction } from "express";
import env from "../config/env.js";

/**
 * Middleware to enforce HTTPS in production
 * Redirects HTTP requests to HTTPS
 * In development, allows HTTP requests
 */
export function enforceHttps(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  /**
   * Only enforce in production environment
   * Development mode allows unencrypted connections for local testing
   */
  if (env.NODE_ENV === "production") {
    /**
     * Check if connection is secure
     * Trust proxy headers if behind load balancer (X-Forwarded-Proto)
     */
    const isSecure = req.secure || req.get("x-forwarded-proto") === "https";

    if (!isSecure) {
      /**
       * Redirect HTTP to HTTPS
       * Preserve original URL and query parameters
       */
      const redirectUrl = `https://${req.get("host")}${req.url}`;
      res.redirect(301, redirectUrl);
      return;
    }
  }

  next();
}
