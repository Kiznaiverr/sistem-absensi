/**
 * Logger Utility
 * Structured logging with colors, file separation, and service-specific coloring
 */

import fs from "fs";
import path from "path";

// ANSI Color codes
const COLORS = {
  RESET: "\x1b[0m",
  GRAY: "\x1b[90m", // DEBUG
  CYAN: "\x1b[36m", // INFO, 3xx responses
  YELLOW: "\x1b[33m", // WARN, 4xx responses
  RED: "\x1b[31m", // ERROR, 5xx responses
  GREEN: "\x1b[32m", // 2xx responses
  MAGENTA: "\x1b[35m", // Service names
  BLUE: "\x1b[34m", // Alternative service color
  WHITE: "\x1b[37m", // General text
  DIM: "\x1b[2m", // Timestamp (dim)
};

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  HTTP = "HTTP",
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Get color for log level
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return COLORS.GRAY;
      case LogLevel.INFO:
        return COLORS.CYAN;
      case LogLevel.WARN:
        return COLORS.YELLOW;
      case LogLevel.ERROR:
        return COLORS.RED;
      case LogLevel.HTTP:
        return COLORS.WHITE;
      default:
        return COLORS.RESET;
    }
  }

  /**
   * Get color for service name
   */
  private getColorForService(serviceName: string): string {
    // Assign consistent colors to different services
    const hash = serviceName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [COLORS.MAGENTA, COLORS.BLUE, COLORS.CYAN, COLORS.GREEN];
    return colors[hash % colors.length];
  }

  /**
   * Get color for HTTP status code
   */
  private getColorForStatusCode(status: number): string {
    if (status >= 200 && status < 300) return COLORS.GREEN;
    if (status >= 300 && status < 400) return COLORS.CYAN;
    if (status >= 400 && status < 500) return COLORS.YELLOW;
    if (status >= 500) return COLORS.RED;
    return COLORS.WHITE;
  }

  /**
   * Format timestamp as HH:MM:SS only
   */
  private getShortTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format standard log message
   */
  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.getShortTimestamp();
    const levelColor = this.getColorForLevel(level);
    const serviceColor = this.getColorForService(this.context);

    const prefix = `${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${levelColor}[${level}]${COLORS.RESET} ${serviceColor}[${this.context}]${COLORS.RESET}`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  /**
   * Format HTTP log message (simplified)
   */
  private formatHTTP(
    method: string,
    pathname: string,
    status: number,
    duration: string,
  ): string {
    const timestamp = this.getShortTimestamp();
    const statusColor = this.getColorForStatusCode(status);

    return `${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${COLORS.WHITE}[HTTP]${COLORS.RESET} ${COLORS.WHITE}[${method} ${pathname}]${COLORS.RESET} ${statusColor}${status}${COLORS.RESET} ${COLORS.DIM}(${duration})${COLORS.RESET}`;
  }

  debug(message: string, data?: any): void {
    console.log(this.format(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: any): void {
    console.log(this.format(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.format(LogLevel.WARN, message, data));
  }

  error(message: string, data?: any): void {
    const formattedMessage = this.format(LogLevel.ERROR, message, data);
    console.error(formattedMessage);

    // Write to error.log file
    try {
      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(logDir, "error.log");

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Remove ANSI codes before writing
      const cleanMessage = formattedMessage.replace(/\x1b\[[0-9;]*m/g, "");
      fs.appendFileSync(logFile, cleanMessage + "\n");
    } catch {
      // Silently fail if we can't write to file
    }
  }

  /**
   * Log HTTP request/response
   * Simplified format: [timestamp] [HTTP] [METHOD /path] status (duration)
   */
  http(
    method: string,
    pathname: string,
    status: number,
    duration: string,
  ): void {
    const message = this.formatHTTP(method, pathname, status, duration);
    console.log(message);

    // Write to http.log file
    try {
      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(logDir, "http.log");

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, "");
      fs.appendFileSync(logFile, cleanMessage + "\n");
    } catch {
      // Silently fail if we can't write to file
    }
  }

  /**
   * Log HTTP error with full details
   * Only write detailed HTTP errors to error.log
   */
  httpError(
    method: string,
    pathname: string,
    status: number,
    duration: string,
    error?: any,
  ): void {
    const timestamp = this.getShortTimestamp();
    const statusColor = this.getColorForStatusCode(status);

    const message = `${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${COLORS.WHITE}[HTTP_ERROR]${COLORS.RESET} ${COLORS.WHITE}[${method} ${pathname}]${COLORS.RESET} ${statusColor}${status}${COLORS.RESET} ${COLORS.DIM}(${duration})${COLORS.RESET}`;
    console.error(message);

    // Write detailed error to error.log
    try {
      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(logDir, "error.log");

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, "");
      let fullError = cleanMessage;
      if (error) {
        fullError += `\nDetails: ${JSON.stringify(error)}`;
      }
      fs.appendFileSync(logFile, fullError + "\n");
    } catch {
      // Silently fail if we can't write to file
    }
  }
}

/**
 * Factory function for creating Logger instances
 */
export const createLogger = (context: string): Logger => {
  return new Logger(context);
};

// Cleanup old error logs (keep last 10MB or 30 days)
export function initializeErrorLogging(): void {
  try {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "error.log");

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Check file size and rotate if > 10MB
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 10 * 1024 * 1024) {
        // Rename current log
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFile = path.join(logDir, `error.log.${timestamp}`);
        fs.renameSync(logFile, backupFile);
      }
    }
  } catch (err) {
    console.error("Failed to initialize error logging", err);
  }
}
