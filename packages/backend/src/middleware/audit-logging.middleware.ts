/**
 * Audit Logging Middleware
 * Logs all API requests for security auditing
 */

import { Request, Response, NextFunction } from "express";
import { AuditService, AuditEventType } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AuditMiddleware");

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
 * Audit logging middleware for API endpoints
 * Logs:
 * - Request method, path, status
 * - Client IP and user agent
 * - Admin ID if authenticated
 * - Suspicious patterns
 */
export async function auditLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const startTime = Date.now();

  /**
   * Hook into response to capture status code and duration
   */
  res.on("finish", async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const adminId = req.admin?.admin_id;

      /**
       * Determine if this is a security-relevant event
       */
      if (statusCode >= 400) {
        /**
         * Log unauthorized/forbidden/error responses
         */
        if (statusCode === 401) {
          /**
           * Unauthorized access attempt
           */
          await AuditService.logEvent({
            timestamp: new Date().toISOString(),
            eventType: AuditEventType.UNAUTHORIZED_ACCESS,
            admin_id: adminId,
            endpoint: req.path,
            method: req.method,
            status: statusCode,
            ip_address: clientIp,
            user_agent: userAgent,
          });
        } else if (statusCode === 403) {
          /**
           * Forbidden access attempt
           */
          await AuditService.logEvent({
            timestamp: new Date().toISOString(),
            eventType: AuditEventType.UNAUTHORIZED_ACCESS,
            admin_id: adminId,
            endpoint: req.path,
            method: req.method,
            status: statusCode,
            ip_address: clientIp,
            user_agent: userAgent,
            details: { reason: "Forbidden" },
          });
        } else if (statusCode === 429) {
          /**
           * Rate limit exceeded
           */
          await AuditService.logRateLimitExceeded(req.path, clientIp);
        }
      }

      /**
       * Log state-changing operations (POST, PUT, DELETE)
       * Helpful for audit trail of modifications
       */
      if (["POST", "PUT", "DELETE"].includes(req.method) && statusCode < 400) {
        logger.info(`State-changing operation: ${req.method} ${req.path}`, {
          admin: adminId,
          ip: clientIp,
          duration: `${duration}ms`,
          status: statusCode,
        });
      }
    } catch (error) {
      logger.error("Error in audit logging middleware", error);
    }
  });

  next();
}
