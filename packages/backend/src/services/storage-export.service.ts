/**
 * Storage Export Service
 * Exports monthly attendance to Excel and uploads to R2
 */

import { subMonths, format, lastDayOfMonth } from "date-fns";
import { supabaseClient } from "../config/database.js";
import { DatabaseService } from "./database.service.js";
import { ExportService } from "./export.service.js";
import { ExcelGenerator, type ExportData } from "./excel/index.js";
import { StorageService } from "./storage.service.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("StorageExportService");

interface ClassConfig {
  name: string;
  schoolType: "SMK" | "SMP";
}

export interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  duration: number;
  details: {
    class: string;
    shift: string;
    success: boolean;
    error?: string;
  }[];
}

export class StorageExportService {
  private static readonly CLASSES: ClassConfig[] = [
    { name: "SMK-1", schoolType: "SMK" },
    { name: "SMK-2", schoolType: "SMK" },
    { name: "SMK-3", schoolType: "SMK" },
    { name: "SMP-1", schoolType: "SMP" },
    { name: "SMP-2", schoolType: "SMP" },
    { name: "SMP-3", schoolType: "SMP" },
  ];

  private static readonly SHIFTS: Array<"siang" | "malam"> = ["siang", "malam"];

  /**
   * Main export function - called from cron job
   * Exports previous month attendance data
   */
  static async exportMonthlyAttendance(): Promise<ExportResult> {
    const startTime = Date.now();
    const details: ExportResult["details"] = [];

    try {
      // Calculate previous month
      const now = new Date();
      const previousMonth = subMonths(now, 1);
      const yearMonth = format(previousMonth, "yyyy-MM");
      const monthName = format(previousMonth, "MMMM yyyy");

      logger.info("Storage export started", { month: yearMonth });

      let exported = 0;
      let failed = 0;

      // For each class and shift combination
      for (const classConfig of this.CLASSES) {
        for (const shift of this.SHIFTS) {
          const result = await this.exportClassShift(
            classConfig,
            shift,
            previousMonth,
            yearMonth,
          );

          details.push({
            class: classConfig.name,
            shift,
            success: result.success,
            error: result.error,
          });

          if (result.success) {
            exported++;
          } else {
            failed++;
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.info("Storage export completed", {
        exported,
        failed,
        duration: `${duration}ms`,
      });

      return {
        success: failed === 0,
        exported,
        failed,
        duration,
        details,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Storage export failed", {
        error: errorMessage,
        duration: `${duration}ms`,
      });

      throw new Error(`Storage export failed: ${errorMessage}`);
    }
  }

  /**
   * Export single class + shift combination
   */
  private static async exportClassShift(
    classConfig: ClassConfig,
    shift: "siang" | "malam",
    monthDate: Date,
    yearMonth: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get class data
      const { data: classData } = await supabaseClient
        .from("classes")
        .select("*")
        .eq("name", classConfig.name)
        .single();

      if (!classData) {
        throw new Error(`Class ${classConfig.name} not found`);
      }

      // Get santri in class
      const { data: santriData } = await supabaseClient
        .from("santri")
        .select("*")
        .eq("class_id", classData.id);

      if (!santriData || santriData.length === 0) {
        logger.warn("No santri found for class", { class: classConfig.name });
        return { success: true }; // Don't fail if no students
      }

      // Get attendance logs for the month using DatabaseService
      const firstDay = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        1,
      );
      const lastDay = lastDayOfMonth(monthDate);
      const dateFrom = firstDay.toISOString().split("T")[0];
      const dateTo = lastDay.toISOString().split("T")[0];

      const attendanceData = await DatabaseService.getAttendanceWithFilters({
        class_id: classData.id,
        shift: shift,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (!attendanceData || attendanceData.length === 0) {
        logger.info("No attendance data found for class shift", {
          class: classConfig.name,
          shift,
          month: yearMonth,
        });
        return { success: true }; // Empty sheet is still valid
      }

      // Build Excel workbook
      const daysInMonth = lastDay.getDate();
      const matrix = ExportService.buildClassMatrix(
        classData,
        santriData,
        attendanceData,
        daysInMonth,
        shift,
      );

      // Generate Excel using ExcelGenerator
      const excelData: ExportData = {
        month: monthDate.getMonth() + 1,
        year: monthDate.getFullYear(),
        monthName: format(monthDate, "MMMM"),
        shift: shift,
        schoolType: classConfig.schoolType,
        daysInMonth: daysInMonth,
        classMatrices: [
          {
            class: { name: classData.name },
            students: matrix.students,
          },
        ],
      };

      const excelGenerator = new ExcelGenerator();
      const buffer = (await excelGenerator.generate(
        excelData,
      )) as unknown as Buffer;

      // Upload to R2
      const schoolTypeFolder = classConfig.schoolType === "SMK" ? "SMK" : "SMP";
      const key = `monthly/${yearMonth}/${schoolTypeFolder}/${classConfig.name}_${shift.toUpperCase()}.xlsx`;

      const uploadResult = await StorageService.uploadFile(
        buffer as unknown as Buffer,
        key,
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      logger.info("Class shift exported successfully", {
        class: classConfig.name,
        shift,
        path: key,
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to export class shift", {
        class: classConfig.name,
        shift,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
