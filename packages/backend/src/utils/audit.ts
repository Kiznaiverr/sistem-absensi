/**
 * Audit Logging Service
 * Tracks security events and user actions with comprehensive context
 */

import fs from "fs";
import path from "path";
import { createLogger } from "./logger.js";

const logger = createLogger("AuditService");

/**
 * Types of security events to audit
 */
export enum AuditEventType {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGIN_INACTIVE_ACCOUNT = "LOGIN_INACTIVE_ACCOUNT",
  TOKEN_REFRESH = "TOKEN_REFRESH",
  TOKEN_REFRESH_FAILED = "TOKEN_REFRESH_FAILED",
  INVALID_TOKEN = "INVALID_TOKEN",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
}

/**
 * Audit event data structure
 */
export interface AuditEvent {
  timestamp: string;
  eventType: AuditEventType;
  admin_id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  status?: number;
  error?: string;
  details?: Record<string, any>;
}

export class AuditService {
  private static readonly AUDIT_LOG_DIR = "logs";
  private static readonly AUDIT_LOG_FILE = "audit.log";

  /**
   * Log a security event
   * Writes to both console and persistent audit log
   */
  static async logEvent(event: AuditEvent): Promise<void> {
    try {
      /**
       * Add timestamp if not present
       */
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      const auditLogEntry = JSON.stringify(event);

      /**
       * Log to console for real-time monitoring
       */
      const logMessage = `[${event.eventType}] ${event.email || event.ip_address || "unknown"} - ${event.details ? JSON.stringify(event.details) : ""}`;
      logger.info(logMessage, {
        eventType: event.eventType,
        ip: event.ip_address,
      });

      /**
       * Write to persistent audit log file
       */
      this.writeToAuditLog(auditLogEntry);
    } catch (error) {
      logger.error("Failed to log audit event", error);
    }
  }

  /**
   * Log successful login
   */
  static async logLoginSuccess(
    admin_id: string,
    email: string,
    username: string,
    ip_address?: string,
    user_agent?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.LOGIN_SUCCESS,
      admin_id,
      email,
      username,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log failed login attempt
   */
  static async logLoginFailed(
    username_or_email: string,
    ip_address?: string,
    user_agent?: string,
    reason?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.LOGIN_FAILED,
      email: username_or_email,
      ip_address,
      user_agent,
      details: { reason },
    });
  }

  /**
   * Log login attempt on inactive account
   */
  static async logLoginInactiveAccount(
    email: string,
    ip_address?: string,
    user_agent?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.LOGIN_INACTIVE_ACCOUNT,
      email,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log successful token refresh
   */
  static async logTokenRefresh(
    admin_id: string,
    email: string,
    ip_address?: string,
    user_agent?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.TOKEN_REFRESH,
      admin_id,
      email,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log failed token refresh
   */
  static async logTokenRefreshFailed(
    ip_address?: string,
    user_agent?: string,
    reason?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.TOKEN_REFRESH_FAILED,
      ip_address,
      user_agent,
      details: { reason },
    });
  }

  /**
   * Log invalid token usage
   */
  static async logInvalidToken(
    endpoint: string,
    method: string,
    ip_address?: string,
    user_agent?: string,
    reason?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.INVALID_TOKEN,
      endpoint,
      method,
      ip_address,
      user_agent,
      details: { reason },
    });
  }

  /**
   * Log unauthorized access attempt
   */
  static async logUnauthorizedAccess(
    endpoint: string,
    method: string,
    ip_address?: string,
    user_agent?: string,
    admin_id?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      admin_id,
      endpoint,
      method,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log rate limit exceeded
   */
  static async logRateLimitExceeded(
    endpoint: string,
    ip_address?: string,
    limit?: number,
    window?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      endpoint,
      ip_address,
      details: { limit, window },
    });
  }

  /**
   * Log expired token usage
   */
  static async logTokenExpired(
    endpoint: string,
    ip_address?: string,
    user_agent?: string,
    admin_id?: string,
  ): Promise<void> {
    await this.logEvent({
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.TOKEN_EXPIRED,
      admin_id,
      endpoint,
      ip_address,
      user_agent,
    });
  }

  /**
   * Write audit log entry to file
   * Handles directory creation and file appending
   */
  private static writeToAuditLog(entry: string): void {
    try {
      const logDir = path.join(process.cwd(), this.AUDIT_LOG_DIR);
      const logFile = path.join(logDir, this.AUDIT_LOG_FILE);

      /**
       * Create logs directory if it doesn't exist
       */
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      /**
       * Append entry to audit log
       */
      fs.appendFileSync(logFile, entry + "\n");
    } catch (error) {
      /**
       * Log to stderr if file write fails
       * Do not throw to prevent audit logging from crashing app
       */
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to write to audit.log", error);
      }
    }
  }

  /**
   * Get recent audit events from log file
   * Parse JSON lines from audit log
   */
  static async getRecentEvents(limit: number = 100): Promise<AuditEvent[]> {
    try {
      const logDir = path.join(process.cwd(), this.AUDIT_LOG_DIR);
      const logFile = path.join(logDir, this.AUDIT_LOG_FILE);

      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line.trim())
        .slice(-limit);

      return lines.map((line) => JSON.parse(line) as AuditEvent);
    } catch (error) {
      logger.error("Failed to read audit events", error);
      return [];
    }
  }
}
