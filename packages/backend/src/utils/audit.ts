/**
 * Audit Logging Service
 * Tracks security events and user actions with comprehensive context
 * Logs to console only (no file writing)
 */

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
  /**
   * Log a security event
   * Logs to console for real-time monitoring
   */
  static async logEvent(event: AuditEvent): Promise<void> {
    try {
      /**
       * Add timestamp if not present
       */
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      /**
       * Log to console for real-time monitoring
       */
      const logMessage = `[${event.eventType}] ${event.email || event.ip_address || "unknown"} - ${event.details ? JSON.stringify(event.details) : ""}`;
      logger.info(logMessage, {
        eventType: event.eventType,
        ip: event.ip_address,
      });
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
   * Generic log method for custom audit events
   * Allows logging of admin actions (santri management, etc)
   */
  static async log(
    eventType: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      /**
       * Log to console for real-time monitoring
       */
      const logMessage = `[${eventType}] ${details.admin_email || details.ip || "unknown"}`;
      logger.info(logMessage, { eventType, ...details });
    } catch (error) {
      logger.error("Failed to log custom audit event", error);
    }
  }
}
