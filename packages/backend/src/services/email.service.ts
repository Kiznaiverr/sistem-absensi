import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { createLogger } from "../utils/logger.js";
import {
  archiveSuccessTemplate,
  archiveFailureTemplate,
  storageExportSuccessTemplate,
  storageExportFailureTemplate,
} from "../utils/email-templates.js";
import { ArchiveResult } from "../services/archive.service.js";
import { ExportResult } from "../services/storage-export.service.js";

const logger = createLogger("EmailService");

/**
 * Email Service
 * Handles sending emails via Google SMTP
 */
export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter (lazy load)
   */
  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      try {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: false, // Use STARTTLS instead of SSL
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
          },
        });

        logger.debug("Email transporter initialized", {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
        });
      } catch (error) {
        logger.error("Failed to initialize email transporter", error);
        throw error;
      }
    }

    return this.transporter;
  }

  /**
   * Send archive success notification
   */
  static async sendArchiveSuccess(result: ArchiveResult): Promise<void> {
    try {
      const template = archiveSuccessTemplate(result);
      const transporter = this.getTransporter();

      const mailOptions = {
        from: `Archive System <${env.SMTP_FROM_EMAIL}>`,
        to: env.ALERT_EMAIL,
        subject: template.subject,
        html: template.html,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Archive success email sent", {
        to: env.ALERT_EMAIL,
        archived: result.archived,
        deleted: result.deleted,
      });
    } catch (error) {
      logger.error("Failed to send archive success email", error);
      // Don't throw - email failure should not break the archive job
    }
  }

  /**
   * Send archive failure notification
   */
  static async sendArchiveFailure(
    error: Error,
    context?: { duration?: number; threshold?: string },
  ): Promise<void> {
    try {
      const template = archiveFailureTemplate(error, context);
      const transporter = this.getTransporter();

      const mailOptions = {
        from: `Archive System <${env.SMTP_FROM_EMAIL}>`,
        to: env.ALERT_EMAIL,
        subject: template.subject,
        html: template.html,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Archive failure email sent", {
        to: env.ALERT_EMAIL,
        error: error.message,
      });
    } catch (error) {
      logger.error("Failed to send archive failure email", error);
      // Don't throw - email failure should not break the archive job
    }
  }

  /**
   * Test SMTP connection (useful for setup/debugging)
   */
  static async testConnection(): Promise<void> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info("SMTP connection verified successfully");
    } catch (error) {
      logger.error("SMTP connection test failed", error);
      throw error;
    }
  }

  /**
   * Send storage export success notification
   */
  static async sendStorageExportSuccess(result: ExportResult): Promise<void> {
    try {
      const template = storageExportSuccessTemplate(result);
      const transporter = this.getTransporter();

      const mailOptions = {
        from: `Storage Export System <${env.SMTP_FROM_EMAIL}>`,
        to: env.ALERT_EMAIL,
        subject: template.subject,
        html: template.html,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Storage export success email sent", {
        to: env.ALERT_EMAIL,
        exported: result.exported,
        failed: result.failed,
      });
    } catch (error) {
      logger.error("Failed to send storage export success email", error);
      // Don't throw - email failure should not break the export job
    }
  }

  /**
   * Send storage export failure notification
   */
  static async sendStorageExportError(context: {
    error: string;
    timestamp: string;
  }): Promise<void> {
    try {
      const template = storageExportFailureTemplate(context);
      const transporter = this.getTransporter();

      const mailOptions = {
        from: `Storage Export System <${env.SMTP_FROM_EMAIL}>`,
        to: env.ALERT_EMAIL,
        subject: template.subject,
        html: template.html,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Storage export failure email sent", {
        to: env.ALERT_EMAIL,
        error: context.error,
      });
    } catch (error) {
      logger.error("Failed to send storage export failure email", error);
      // Don't throw - email failure should not break the export job
    }
  }
}
