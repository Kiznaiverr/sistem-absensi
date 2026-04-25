import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { resolve, basename } from "path";
import ExcelJS from "exceljs";
import { DatabaseService, SantriImportJob } from "./database.service.js";
import {
  SantriImportService,
  type ProgressEvent,
} from "./santri-import.service.js";
import { cacheService } from "./cache.service.js";
import { AuditService } from "../utils/audit.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("SantriImportJobService");
const IMPORT_UPLOAD_DIR = resolve(process.cwd(), "logs", "imports");

export class SantriImportJobService {
  private static isProcessing = false;

  /**
   * Save upload file and create queued background job.
   */
  static async createQueuedJob(params: {
    fileBuffer: Buffer;
    fileName: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<SantriImportJob> {
    await fs.mkdir(IMPORT_UPLOAD_DIR, { recursive: true });

    const safeName = basename(params.fileName).replace(/[^A-Za-z0-9._-]/g, "_");
    const tempName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const filePath = resolve(IMPORT_UPLOAD_DIR, tempName);

    await fs.writeFile(filePath, params.fileBuffer);

    try {
      return await DatabaseService.createSantriImportJob({
        fileName: params.fileName,
        filePath,
        createdBy: params.adminId,
        createdByEmail: params.adminEmail,
      });
    } catch (error) {
      await this.safeDeleteFile(filePath);
      throw error;
    }
  }

  /**
   * Process one queued job at a time.
   */
  static async processNextQueuedJob(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      const job = await DatabaseService.claimNextQueuedSantriImportJob();
      if (!job) return;
      await this.processJob(job);
    } catch (error) {
      logger.error("Failed to process queued job", error);
    } finally {
      this.isProcessing = false;
    }
  }

  static async getJob(jobId: string): Promise<SantriImportJob | null> {
    return DatabaseService.getSantriImportJobById(jobId);
  }

  static async exportJobErrorsExcel(jobId: string): Promise<Buffer> {
    const errors = await DatabaseService.getSantriImportJobErrors(jobId);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Import Errors");

    worksheet.columns = [
      { header: "Row", key: "row", width: 10 },
      { header: "Name", key: "name", width: 30 },
      { header: "RFID", key: "rfid", width: 24 },
      { header: "Class", key: "class", width: 20 },
      { header: "Error Type", key: "errorType", width: 28 },
      { header: "Message", key: "message", width: 60 },
      { header: "Severity", key: "severity", width: 14 },
    ];

    for (const err of errors) {
      worksheet.addRow({
        row: err.row_number,
        name: err.name,
        rfid: err.rfid_id,
        class: err.class_name,
        errorType: err.error_type,
        message: err.message,
        severity: err.severity,
      });
    }

    if (errors.length === 0) {
      worksheet.addRow({
        row: "-",
        message: "Tidak ada error untuk job ini",
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  static async cleanupExpiredJobs(): Promise<void> {
    const expiredJobs = await DatabaseService.getExpiredSantriImportJobs();
    if (expiredJobs.length === 0) return;

    for (const job of expiredJobs) {
      await this.safeDeleteFile(job.file_path);
    }

    await DatabaseService.deleteSantriImportJobs(
      expiredJobs.map((job) => job.id),
    );

    logger.info("Expired import jobs deleted", { count: expiredJobs.length });
  }

  private static async processJob(job: SantriImportJob): Promise<void> {
    let fileBuffer: Buffer;

    try {
      fileBuffer = await fs.readFile(job.file_path);
    } catch (error) {
      await DatabaseService.failSantriImportJob(
        job.id,
        "File import tidak ditemukan atau tidak dapat dibaca",
      );
      logger.error("Import file read failed", { jobId: job.id, error });
      return;
    }

    try {
      const result = await SantriImportService.importFromExcel(
        fileBuffer,
        job.created_by || "system",
        job.created_by_email || "system",
        (event: ProgressEvent) => {
          void DatabaseService.updateSantriImportJobProgress(job.id, {
            stage: event.stage,
            message: event.message,
            progressPercent: event.percentage,
            totalRows: event.total,
            processedRows: event.current,
          }).catch((error) => {
            logger.warn("Failed to persist import progress", {
              jobId: job.id,
              error,
            });
          });
        },
      );

      await DatabaseService.saveSantriImportJobErrors(
        job.id,
        result.errors.map((err) => ({
          row: err.row,
          name: err.data.name,
          rfid_id: err.data.rfid_id,
          class_name: err.data.class_name,
          error_type: err.error_type,
          message: err.message,
          severity: err.severity,
        })),
      );

      await DatabaseService.completeSantriImportJob(job.id, {
        totalRows: result.summary.total_rows,
        processedRows: result.summary.total_rows,
        successCount: result.summary.imported,
        errorCount: result.errors.length,
        message: `Selesai. ${result.summary.imported} data berhasil diimpor`,
        ttlMinutes: 5,
      });

      if (result.summary.imported > 0) {
        const deletedKeys = cacheService.deleteByPrefix("santri:class:");
        logger.info("Invalidated santri class cache after import", {
          deleted_keys: deletedKeys,
        });

        await AuditService.log("SANTRI_BULK_IMPORT", {
          admin_id: job.created_by,
          admin_email: job.created_by_email,
          total_rows: result.summary.total_rows,
          imported_count: result.summary.imported,
          skipped_count: result.summary.skipped,
          file_name: job.file_name,
          error_count: result.errors.length,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat import";
      await DatabaseService.failSantriImportJob(job.id, message);
      logger.error("Import job failed", { jobId: job.id, error });
    } finally {
      await this.safeDeleteFile(job.file_path);
    }
  }

  private static async safeDeleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore file-not-found and cleanup errors.
    }
  }
}
