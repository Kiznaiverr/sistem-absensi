/**
 * Santri Import Service
 * Handles Excel file parsing, validation, and bulk import
 */

import ExcelJS from "exceljs";
import { DatabaseService } from "./database.service.js";
import { createLogger } from "../utils/logger.js";
import type { ProgressEvent } from "./import-progress.service.js";
import { TEMPLATE_DATA_START_ROW } from "./santri-template.service.js";

const logger = createLogger("SantriImportService");

export interface ImportRow {
  row_number: number;
  name: string;
  rfid_id: string;
  class_name: string;
}

export interface ValidatedRow extends ImportRow {
  class_id: string;
}

export interface ImportError {
  row: number;
  data: {
    name: string;
    rfid_id: string;
    class_name: string;
  };
  error_type: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportResult {
  success: boolean;
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    imported_at: string;
  };
  errors: ImportError[];
}

const MAX_ROWS = 5000;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 255;
const MAX_RFID_LENGTH = 255;
const RFID_PATTERN = /^[A-Za-z0-9]+$/;

export class SantriImportService {
  /**
   * Parse Excel file and validate all rows
   * Supports optional progress callback for real-time updates
   */
  static async importFromExcel(
    fileBuffer: Buffer,
    adminId: string,
    adminEmail: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<ImportResult> {
    try {
      const startTime = Date.now();
      const errors: ImportError[] = [];
      const validatedRows: ValidatedRow[] = [];
      const seenRFIDs = new Map<string, number>(); // Track RFIDs within file

      // Step 1: Parse Excel file
      onProgress?.({
        stage: "parsing",
        current: 0,
        total: 100,
        percentage: 0,
        message: "Membaca file Excel...",
      });

      const rows = await this.parseExcelFile(fileBuffer);

      if (rows.length === 0) {
        return this.createErrorResponse(
          "EMPTY_FILE",
          "Tidak ada data dalam berkas",
        );
      }

      if (rows.length > MAX_ROWS) {
        return this.createErrorResponse(
          "FILE_TOO_LARGE",
          `Berkas terlalu besar (max ${MAX_ROWS} baris)`,
        );
      }

      // Step 2: Get all classes for mapping
      const classes = await DatabaseService.getClasses();
      const classMap = new Map(classes.map((c) => [c.name, c.id]));

      // Step 3: Validate each row
      onProgress?.({
        stage: "validating",
        current: 0,
        total: rows.length,
        percentage: 0,
        message: `Validasi ${rows.length} baris...`,
      });

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2; // +2 because Excel rows start at 1 and header is row 1
        const row = rows[i];

        // Validate name
        const nameValidation = this.validateName(row.name);
        if (nameValidation.error) {
          errors.push({
            row: rowNum,
            data: {
              name: row.name,
              rfid_id: row.rfid_id,
              class_name: row.class_name,
            },
            error_type: nameValidation.errorType,
            message: nameValidation.error,
            severity: "error",
          });
          continue;
        }

        // Validate RFID
        const rfidValidation = this.validateRFID(row.rfid_id);
        if (rfidValidation.error) {
          errors.push({
            row: rowNum,
            data: {
              name: row.name,
              rfid_id: row.rfid_id,
              class_name: row.class_name,
            },
            error_type: rfidValidation.errorType,
            message: rfidValidation.error,
            severity: "error",
          });
          continue;
        }

        // Check RFID duplicate in file
        if (seenRFIDs.has(row.rfid_id)) {
          errors.push({
            row: rowNum,
            data: {
              name: row.name,
              rfid_id: row.rfid_id,
              class_name: row.class_name,
            },
            error_type: "RFID_DUPLICATE_IN_FILE",
            message: `RFID ID ${row.rfid_id} sudah ada dalam berkas ini (baris ${seenRFIDs.get(row.rfid_id)})`,
            severity: "warning",
          });
          continue;
        }
        seenRFIDs.set(row.rfid_id, rowNum);

        // Validate class name
        const classNameValidation = this.validateClassName(row.class_name);
        if (classNameValidation.error) {
          errors.push({
            row: rowNum,
            data: {
              name: row.name,
              rfid_id: row.rfid_id,
              class_name: row.class_name,
            },
            error_type: classNameValidation.errorType,
            message: classNameValidation.error,
            severity: "error",
          });
          continue;
        }

        // Map class name to ID
        const classId = classMap.get(row.class_name);
        if (!classId) {
          errors.push({
            row: rowNum,
            data: {
              name: row.name,
              rfid_id: row.rfid_id,
              class_name: row.class_name,
            },
            error_type: "CLASS_NOT_FOUND",
            message: `Kelas '${row.class_name}' tidak ditemukan di database`,
            severity: "error",
          });
          continue;
        }

        // All validations passed, add to validated rows
        validatedRows.push({
          row_number: rowNum,
          name: row.name.trim(),
          rfid_id: row.rfid_id.trim(),
          class_name: row.class_name,
          class_id: classId,
        });

        // Report progress every 10 rows or at the end
        if ((i + 1) % 10 === 0 || i === rows.length - 1) {
          onProgress?.({
            stage: "validating",
            current: i + 1,
            total: rows.length,
            percentage: Math.round(((i + 1) / rows.length) * 50), // 0-50%
            message: `Validasi baris ${i + 1}/${rows.length}...`,
          });
        }
      }

      // Step 4: Check RFID duplicates in database
      onProgress?.({
        stage: "checking_db",
        current: 0,
        total: validatedRows.length,
        percentage: 50,
        message: `Cek RFID di database...`,
      });

      const dbRFIDErrors: ImportError[] = [];
      for (let idx = 0; idx < validatedRows.length; idx++) {
        const validRow = validatedRows[idx];
        const rfidExists = await DatabaseService.checkRFIDExists(
          validRow.rfid_id,
        );
        if (rfidExists) {
          dbRFIDErrors.push({
            row: validRow.row_number,
            data: {
              name: validRow.name,
              rfid_id: validRow.rfid_id,
              class_name: validRow.class_name,
            },
            error_type: "RFID_DUPLICATE_IN_DB",
            message: `RFID ID ${validRow.rfid_id} sudah ada di database`,
            severity: "error",
          });
        }

        // Report progress every 10 rows or at the end
        if ((idx + 1) % 10 === 0 || idx === validatedRows.length - 1) {
          onProgress?.({
            stage: "checking_db",
            current: idx + 1,
            total: validatedRows.length,
            percentage:
              50 + Math.round(((idx + 1) / validatedRows.length) * 25), // 50-75%
            message: `Cek RFID ${idx + 1}/${validatedRows.length}...`,
          });
        }
      }

      // Remove rows with DB RFID duplicates from validated list
      const validRowsToImport = validatedRows.filter(
        (vr) =>
          !dbRFIDErrors.some(
            (err) =>
              err.data.rfid_id === vr.rfid_id &&
              err.error_type === "RFID_DUPLICATE_IN_DB",
          ),
      );

      errors.push(...dbRFIDErrors);

      // Step 5: Insert validated rows into database
      onProgress?.({
        stage: "inserting",
        current: 0,
        total: validRowsToImport.length,
        percentage: 75,
        message: `Menyimpan ${validRowsToImport.length} data ke database...`,
      });
      let importedCount = 0;
      if (validRowsToImport.length > 0) {
        try {
          importedCount = await this.insertSantriRows(
            validRowsToImport,
            onProgress,
          );
        } catch (insertError) {
          logger.error("Failed to insert santri rows", insertError);
          throw new Error("Gagal menyimpan data ke database");
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `Import completed: ${importedCount} imported, ${errors.length} errors, ${duration}ms`,
      );

      const result = {
        success: true,
        summary: {
          total_rows: rows.length,
          imported: importedCount,
          skipped: rows.length - importedCount,
          imported_at: new Date().toISOString(),
        },
        errors,
      };

      onProgress?.({
        stage: "completed",
        current: importedCount,
        total: rows.length,
        percentage: 100,
        message: `Selesai! ${importedCount} data berhasil diimpor`,
        result,
      });

      return result;
    } catch (error) {
      logger.error("Import failed", error);
      onProgress?.({
        stage: "error",
        current: 0,
        total: 0,
        percentage: 0,
        message: "Import gagal",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Parse Excel file and extract data
   */
  private static async parseExcelFile(
    fileBuffer: Buffer,
  ): Promise<ImportRow[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error("Tidak ada sheet dalam berkas Excel");
      }

      const headerRow = worksheet.getRow(1);

      // Verify header row
      const headers = this.extractRowValues(headerRow);
      if (headers.length < 4) {
        throw new Error("Format Excel tidak valid");
      }

      // Extract data rows starting from row 6
      // Column A: nomor, B: nama, C: rfid_id, D: kelas
      const rows: ImportRow[] = [];

      for (let rowNum = 6; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (!row) continue;

        const values = this.extractRowValues(row);

        // Skip empty rows
        if (values.every((v) => !v || v.toString().trim() === "")) {
          continue;
        }

        // Extract columns: A=nomor (index 0), B=nama (index 1), C=rfid_id (index 2), D=kelas (index 3)
        const name = values[1]?.toString().trim() || "";
        const rfid_id = values[2]?.toString().trim() || "";
        const class_name = values[3]?.toString().trim() || "";

        if (!name && !rfid_id && !class_name) {
          continue; // Skip completely empty rows
        }

        rows.push({
          row_number: rowNum, // Actual Excel row number
          name,
          rfid_id,
          class_name,
        });
      }

      return rows;
    } catch (error) {
      logger.error("Failed to parse Excel file", error);
      throw new Error("Gagal membaca berkas Excel");
    }
  }

  /**
   * Extract values from Excel row
   */
  private static extractRowValues(
    row: ExcelJS.Row,
  ): (string | number | null | undefined)[] {
    const values: (string | number | null | undefined)[] = [];
    for (let col = 1; col <= 5; col++) {
      const cell = row.getCell(col);
      values.push(cell.value as string | number | null | undefined);
    }
    return values;
  }

  /**
   * Validate name field
   */
  private static validateName(name: string): {
    error: string | null;
    errorType: string;
  } {
    const trimmedName = name.toString().trim();

    if (!trimmedName) {
      return { error: "Nama santri kosong", errorType: "EMPTY_NAME" };
    }

    if (trimmedName.length < MIN_NAME_LENGTH) {
      return {
        error: `Nama santri terlalu pendek (min ${MIN_NAME_LENGTH} karakter)`,
        errorType: "INVALID_NAME_LENGTH",
      };
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return {
        error: `Nama santri terlalu panjang (max ${MAX_NAME_LENGTH} karakter)`,
        errorType: "INVALID_NAME_LENGTH",
      };
    }

    return { error: null, errorType: "" };
  }

  /**
   * Validate RFID field
   */
  private static validateRFID(rfid: string): {
    error: string | null;
    errorType: string;
  } {
    const trimmedRFID = rfid.toString().trim();

    if (!trimmedRFID) {
      return { error: "RFID ID kosong", errorType: "EMPTY_RFID" };
    }

    if (!RFID_PATTERN.test(trimmedRFID)) {
      return {
        error: "Format RFID ID tidak valid (hanya alphanumeric)",
        errorType: "INVALID_RFID_FORMAT",
      };
    }

    if (trimmedRFID.length > MAX_RFID_LENGTH) {
      return {
        error: `RFID ID terlalu panjang (max ${MAX_RFID_LENGTH} karakter)`,
        errorType: "INVALID_RFID_FORMAT",
      };
    }

    return { error: null, errorType: "" };
  }

  /**
   * Validate class name field
   */
  private static validateClassName(className: string): {
    error: string | null;
    errorType: string;
  } {
    const trimmedClassName = className.toString().trim();

    if (!trimmedClassName) {
      return { error: "Nama kelas kosong", errorType: "EMPTY_CLASS_NAME" };
    }

    return { error: null, errorType: "" };
  }

  /**
   * Insert santri rows into database with batch processing
   */
  private static async insertSantriRows(
    rows: ValidatedRow[],
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const BATCH_SIZE = 10; // Insert 10 rows at a time
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

      try {
        const batchInsertData = batch.map((row) => ({
          name: row.name,
          rfid_id: row.rfid_id,
          class_id: row.class_id,
        }));

        const inserted =
          await DatabaseService.bulkCreateSantri(batchInsertData);
        insertedCount += inserted;

        // Report progress after each batch
        const percentage =
          75 + Math.round(((i + batch.length) / rows.length) * 25); // 75-100%
        onProgress?.({
          stage: "inserting",
          current: i + batch.length,
          total: rows.length,
          percentage,
          message: `Menyimpan batch ${batchNumber}/${totalBatches} (${i + batch.length}/${rows.length} data)`,
        });
      } catch (error) {
        logger.error(
          `Failed to insert batch ${batchNumber}/${totalBatches}`,
          error,
        );
        // Continue with next batch instead of failing entire import
      }
    }

    return insertedCount;
  }

  /**
   * Create error response
   */
  private static createErrorResponse(
    errorType: string,
    message: string,
  ): ImportResult {
    return {
      success: false,
      summary: {
        total_rows: 0,
        imported: 0,
        skipped: 0,
        imported_at: new Date().toISOString(),
      },
      errors: [
        {
          row: 0,
          data: { name: "", rfid_id: "", class_name: "" },
          error_type: errorType,
          message,
          severity: "error",
        },
      ],
    };
  }
}
