import { createLogger } from "../utils/logger.js";
import { formatFileSize } from "../utils/format.js";
import { pathToFileURL } from "url";
import { format, lastDayOfMonth } from "date-fns";
import { supabaseClient } from "../config/database.js";
import { DatabaseService } from "../services/database.service.js";
import { ExportService } from "../services/export.service.js";
import { ExcelGenerator, type ExportData } from "../services/excel/index.js";
import { StorageService } from "../services/storage.service.js";

const logger = createLogger("ManualStorageExportTrigger");

interface ClassConfig {
  name: string;
  schoolType: "SMK" | "SMP";
}

interface ExportDetail {
  class: string;
  shift: string;
  success: boolean;
  error?: string;
}

interface TestExportResult {
  success: boolean;
  exported: number;
  failed: number;
  duration: number;
  details: ExportDetail[];
  month: string;
}

/**
 * Manual storage export for current month testing
 * Exports current month attendance data and uploads to R2
 */
export async function triggerManualStorageExportForTesting(): Promise<void> {
  const startTime = Date.now();
  const details: ExportDetail[] = [];

  logger.info("Running manual storage export for testing (current month)");

  try {
    const CLASSES: ClassConfig[] = [
      { name: "SMK-1", schoolType: "SMK" },
      { name: "SMK-2", schoolType: "SMK" },
      { name: "SMK-3", schoolType: "SMK" },
      { name: "SMP-1", schoolType: "SMP" },
      { name: "SMP-2", schoolType: "SMP" },
      { name: "SMP-3", schoolType: "SMP" },
    ];

    const SHIFTS: Array<"siang" | "malam"> = ["siang", "malam"];

    // Use current month for testing
    const now = new Date();
    const yearMonth = format(now, "yyyy-MM");
    const monthName = format(now, "MMMM yyyy");

    logger.info("Storage export started", {
      month: yearMonth,
      name: monthName,
    });

    let exported = 0;
    let failed = 0;

    // Export each class and shift combination
    for (const classConfig of CLASSES) {
      for (const shift of SHIFTS) {
        try {
          logger.info("Exporting", {
            class: classConfig.name,
            shift,
          });

          // Query class data from supabase
          const { data: classData, error: classError } = await supabaseClient
            .from("classes")
            .select("*")
            .eq("name", classConfig.name)
            .single();

          if (classError || !classData) {
            throw new Error(`Class not found: ${classConfig.name}`);
          }

          // Query santri in class
          const { data: santriData } = await supabaseClient
            .from("santri")
            .select("*")
            .eq("class_id", classData.id);

          if (!santriData || santriData.length === 0) {
            logger.warn("No santri found for class", {
              class: classConfig.name,
            });

            details.push({
              class: classConfig.name,
              shift,
              success: true,
              error: "No santri data",
            });
            exported++;
            continue;
          }

          // Get attendance logs for the month using DatabaseService
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = lastDayOfMonth(now);
          const dateFrom = firstDay.toISOString().split("T")[0];
          const dateTo = lastDay.toISOString().split("T")[0];

          const attendanceData = await DatabaseService.getAttendanceWithFilters(
            {
              class_id: classData.id,
              shift: shift,
              date_from: dateFrom,
              date_to: dateTo,
            },
          );

          if (!attendanceData || attendanceData.length === 0) {
            logger.warn("No attendance data found for class shift", {
              class: classConfig.name,
              shift,
            });

            details.push({
              class: classConfig.name,
              shift,
              success: true,
              error: "No data",
            });
            exported++;
            continue;
          }

          // Build matrix using ExportService
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
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            monthName: format(now, "MMMM"),
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
          const schoolTypeFolder =
            classConfig.schoolType === "SMK" ? "SMK" : "SMP";
          const key = `monthly/${yearMonth}/${schoolTypeFolder}/${classConfig.name}_${shift.toUpperCase()}.xlsx`;

          const uploadResult = await StorageService.uploadFile(
            buffer as unknown as Buffer,
            key,
          );

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || "Upload failed");
          }

          logger.info("Export successful", {
            class: classConfig.name,
            shift,
            path: uploadResult.path,
            size: formatFileSize(uploadResult.size),
          });

          details.push({
            class: classConfig.name,
            shift,
            success: true,
          });
          exported++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          logger.error("Export failed", {
            class: classConfig.name,
            shift,
            error: errorMessage,
          });

          details.push({
            class: classConfig.name,
            shift,
            success: false,
            error: errorMessage,
          });
          failed++;
        }
      }
    }

    const duration = Date.now() - startTime;
    const result: TestExportResult = {
      success: failed === 0,
      exported,
      failed,
      duration,
      details,
      month: yearMonth,
    };

    logger.info("Manual storage export testing completed", {
      month: yearMonth,
      exported: result.exported,
      failed: result.failed,
      duration: `${duration}ms`,
      success: result.success,
    });

    // Print detailed results
    console.log("\n========== MANUAL STORAGE EXPORT RESULTS ==========");
    console.log(`Month: ${monthName}`);
    console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Exported: ${result.exported}/12`);
    console.log(`Failed: ${result.failed}/12`);
    console.log(`Duration: ${result.duration}ms`);
    console.log("\nDetails:");
    console.table(result.details);
    console.log("==================================================\n");
  } catch (error) {
    logger.error("Manual storage export testing failed", error);
    console.error(
      "\nManual storage export testing error:",
      error instanceof Error ? error.message : error,
    );
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await triggerManualStorageExportForTesting();
}
