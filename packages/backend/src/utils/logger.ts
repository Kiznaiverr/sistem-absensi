/**
 * Logger Utility
 * Simple logging with timestamps and levels with color support
 * Errors are also written to error.log file
 */

import fs from "fs";
import path from "path";

// ANSI Color codes
const COLORS = {
  RESET: "\x1b[0m",
  GRAY: "\x1b[90m", // DEBUG
  CYAN: "\x1b[36m", // INFO
  YELLOW: "\x1b[33m", // WARN
  RED: "\x1b[31m", // ERROR
  DIM: "\x1b[2m", // Timestamp (dim)
};

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return COLORS.GRAY;
      case LogLevel.INFO:
        return COLORS.CYAN;
      case LogLevel.WARN:
        return COLORS.YELLOW;
      case LogLevel.ERROR:
        return COLORS.RED;
      default:
        return COLORS.RESET;
    }
  }

  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const color = this.getColorCode(level);

    // Format: [timestamp] [LEVEL with color] [context] message data
    const prefix = `${COLORS.DIM}[${timestamp}]${COLORS.RESET} ${color}[${level}]${COLORS.RESET} [${this.context}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
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

      // Create logs directory if not exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to error.log (remove ANSI colors for file)
      const cleanMessage = formattedMessage
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/\[DEBUG\]|\[INFO\]|\[WARN\]|\[ERROR\]/g, (match) => match);

      fs.appendFileSync(logFile, cleanMessage + "\n");
    } catch (err) {
      // Silent fail if logging fails
      console.error("Failed to write to error.log", err);
    }
  }
}

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
