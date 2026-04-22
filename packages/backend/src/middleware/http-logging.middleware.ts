/**
 * HTTP Logging Middleware
 * Logs HTTP requests with simplified format
 * Full details only written on error
 */

import { Request, Response, NextFunction } from "express";
import { Logger } from "../utils/logger.js";

const logger = new Logger("HTTPLogger");

/**
 * Middleware to log HTTP requests/responses
 * Simplified format: [TIME] [HTTP] [METHOD /path] STATUS (duration)
 * Only full details on error responses (4xx, 5xx)
 */
export function httpLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Hook into response to capture status and duration
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    const durationStr = `${duration}ms`;

    // Log HTTP request/response
    if (status >= 400) {
      // Log errors with full details
      logger.httpError(method, path, status, durationStr);
    } else {
      // Log normal requests simplified
      logger.http(method, path, status, durationStr);
    }
  });

  next();
}
