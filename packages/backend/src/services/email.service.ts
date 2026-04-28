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

  /**
   * Send shift-end error summary notification
   */
  static async sendShiftEndErrorSummary(data: {
    shift: "siang" | "malam";
    date: string;
    total_errors: number;
    errors_by_code: Array<{
      error_code: string;
      error_message: string;
      count: number;
      details: Array<{
        rfid_id: string;
        santri_name?: string;
        timestamp: string;
        error_message: string;
      }>;
    }>;
  }): Promise<void> {
    try {
      const shiftName = data.shift === "siang" ? "Siang" : "Malam";
      const transporter = this.getTransporter();

      // Build HTML content
      let htmlContent = `
        <h2>Laporan Error Absensi - Shift ${shiftName}</h2>
        <p><strong>Tanggal:</strong> ${data.date}</p>
        <p><strong>Total Error:</strong> ${data.total_errors}</p>
        <hr>
      `;

      if (data.errors_by_code.length === 0) {
        htmlContent += `<p style="color: green;"><strong>✓ Tidak ada error untuk shift ini</strong></p>`;
      } else {
        for (const group of data.errors_by_code) {
          htmlContent += `
            <h3>${group.error_code}</h3>
            <p><strong>Pesan:</strong> ${group.error_message}</p>
            <p><strong>Jumlah:</strong> ${group.count}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">RFID</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nama Santri</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Waktu</th>
                </tr>
              </thead>
              <tbody>
          `;

          for (const detail of group.details.slice(0, 10)) {
            // Limit to 10 rows per error type
            htmlContent += `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${detail.rfid_id}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${detail.santri_name || "-"}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${detail.timestamp}</td>
              </tr>
            `;
          }

          if (group.details.length > 10) {
            htmlContent += `
              <tr style="background-color: #f9f9f9;">
                <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                  <em>... dan ${group.details.length - 10} data lainnya</em>
                </td>
              </tr>
            `;
          }

          htmlContent += `
              </tbody>
            </table>
            <hr>
          `;
        }
      }

      const mailOptions = {
        from: `Attendance System <${env.SMTP_FROM_EMAIL}>`,
        to: env.ALERT_EMAIL,
        subject: `Laporan Error Absensi - Shift ${shiftName} (${data.date})`,
        html: htmlContent,
      };

      await transporter.sendMail(mailOptions);
      logger.info("Shift-end error summary email sent", {
        to: env.ALERT_EMAIL,
        shift: data.shift,
        date: data.date,
        total_errors: data.total_errors,
      });
    } catch (error) {
      logger.error("Failed to send shift-end error summary email", error);
      // Don't throw - email failure should not break the job
    }
  }
}
