/**
 * Excel Generator Service
 * Main class for generating Excel workbooks from attendance data
 */

import ExcelJS from "exceljs";
import { EXCEL_CONFIG, PAGE_SETUP } from "./ExcelStyles.js";
import { ExcelFormatters } from "./ExcelFormatters.js";

export interface ExportData {
  month: number;
  year: number;
  monthName: string;
  shift: string;
  schoolType: string;
  daysInMonth: number;
  classMatrices: Array<{
    class: { name: string };
    students: Array<{
      name: string;
      attendance: boolean[];
    }>;
  }>;
}

export class ExcelGenerator {
  private workbook: ExcelJS.Workbook;
  private daysInMonth: number;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.daysInMonth = EXCEL_CONFIG.DAYS_IN_MONTH;
  }

  /**
   * Generate Excel workbook from JSON data
   * Returns ArrayBuffer for download
   */
  async generate(data: ExportData): Promise<ArrayBuffer> {
    try {
      const isMultipleSheets = data.classMatrices.length > 1;

      if (isMultipleSheets) {
        await this.generateMultipleSheets(data);
      } else {
        await this.generateSingleSheet(data);
      }

      // Apply page setup to all sheets
      this.workbook.eachSheet((worksheet) => {
        worksheet.pageSetup = PAGE_SETUP as any;
      });

      // Return buffer for download
      return (await this.workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
    } catch (error) {
      console.error("Error generating Excel:", error);
      throw error;
    }
  }

  /**
   * Generate single sheet Excel
   */
  private async generateSingleSheet(data: ExportData) {
    // Remove default worksheet
    if (this.workbook.worksheets.length > 0) {
      this.workbook.removeWorksheet(this.workbook.worksheets[0].id);
    }

    const worksheet = this.workbook.addWorksheet("Absensi");
    const classData = data.classMatrices[0];

    this.buildSheet(worksheet, classData, data);
  }

  /**
   * Generate multiple sheets (one per class)
   */
  private async generateMultipleSheets(data: ExportData) {
    // Remove default worksheet
    if (this.workbook.worksheets.length > 0) {
      this.workbook.removeWorksheet(this.workbook.worksheets[0].id);
    }

    for (const classMatrix of data.classMatrices) {
      const sheetName = classMatrix.class.name.replace(/[^a-zA-Z0-9]/g, "");
      const worksheet = this.workbook.addWorksheet(sheetName);
      this.buildSheet(worksheet, classMatrix, data);
    }
  }

  /**
   * Build single worksheet sheet
   */
  private buildSheet(
    worksheet: ExcelJS.Worksheet,
    classData: ExportData["classMatrices"][0],
    metadata: ExportData,
  ) {
    // Set column widths
    ExcelFormatters.setColumnWidths(worksheet, this.daysInMonth);

    let currentRow = 1;

    // Row 1: Title
    currentRow = this.addTitleRow(worksheet, currentRow, metadata);

    // Row 2: School name
    currentRow = this.addSchoolNameRow(worksheet, currentRow);

    // Row 3: Month info
    currentRow = this.addMonthInfoRow(worksheet, currentRow, metadata);

    // Row 4: Class info
    currentRow = this.addClassInfoRow(worksheet, currentRow, classData);

    // Row 5-6: Headers (No, Nama, Tanggal)
    currentRow = this.addHeaderRows(worksheet, currentRow);

    // Rows 7+: Student data
    this.addStudentRows(worksheet, currentRow, classData);
  }

  private addTitleRow(
    worksheet: ExcelJS.Worksheet,
    row: number,
    data: ExportData,
  ): number {
    const titleCell = worksheet.getCell(row, 1);
    titleCell.value = `ABSENSI MADRASAH ${data.shift.toUpperCase()}`;
    ExcelFormatters.styleTitle(titleCell);

    const range = ExcelFormatters.getCellRange(1, this.daysInMonth + 2, row);
    worksheet.mergeCells(range);

    return row + 1;
  }

  private addSchoolNameRow(worksheet: ExcelJS.Worksheet, row: number): number {
    const cell = worksheet.getCell(row, 1);
    cell.value = EXCEL_CONFIG.COMPANY_NAME;
    ExcelFormatters.styleSubtitle(cell);

    const range = ExcelFormatters.getCellRange(1, this.daysInMonth + 2, row);
    worksheet.mergeCells(range);

    return row + 1;
  }

  private addMonthInfoRow(
    worksheet: ExcelJS.Worksheet,
    row: number,
    data: ExportData,
  ): number {
    const cell = worksheet.getCell(row, 1);
    cell.value = `Bulan: ${data.monthName} ${data.year}`;
    ExcelFormatters.styleInfo(cell);

    const range = ExcelFormatters.getCellRange(1, this.daysInMonth + 2, row);
    worksheet.mergeCells(range);

    return row + 1;
  }

  private addClassInfoRow(
    worksheet: ExcelJS.Worksheet,
    row: number,
    classData: ExportData["classMatrices"][0],
  ): number {
    const cell = worksheet.getCell(row, 1);
    cell.value = `Kelas: ${classData.class.name}`;
    ExcelFormatters.styleInfo(cell);

    const range = ExcelFormatters.getCellRange(1, this.daysInMonth + 2, row);
    worksheet.mergeCells(range);

    return row + 1;
  }

  private addHeaderRows(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
  ): number {
    const row1 = startRow;
    const row2 = startRow + 1;

    // Row 1: Headers (No, Nama, Tanggal)
    const noCell = worksheet.getCell(row1, 1);
    noCell.value = "No";
    ExcelFormatters.styleHeader(noCell);

    const nameCell = worksheet.getCell(row1, 2);
    nameCell.value = "Nama";
    ExcelFormatters.styleHeader(nameCell);

    const dateCell = worksheet.getCell(row1, 3);
    dateCell.value = "Tanggal";
    ExcelFormatters.styleHeader(dateCell);

    // Merge header cells
    worksheet.mergeCells(`A${row1}:A${row2}`);
    worksheet.mergeCells(`B${row1}:B${row2}`);
    worksheet.mergeCells(
      ExcelFormatters.getCellRange(3, this.daysInMonth + 2, row1),
    );

    // Row 2: Date numbers (1-31)
    for (let i = 1; i <= this.daysInMonth; i++) {
      const dateCell = worksheet.getCell(row2, i + 2);
      dateCell.value = i;
      ExcelFormatters.styleDate(dateCell);
    }

    return row2 + 1;
  }

  private addStudentRows(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    classData: ExportData["classMatrices"][0],
  ) {
    for (let idx = 0; idx < classData.students.length; idx++) {
      const student = classData.students[idx];
      const row = startRow + idx;

      // No column
      const noCell = worksheet.getCell(row, 1);
      noCell.value = idx + 1;
      ExcelFormatters.styleNumber(noCell);

      // Name column
      const nameCell = worksheet.getCell(row, 2);
      nameCell.value = student.name;
      ExcelFormatters.styleName(nameCell);

      // Attendance columns
      for (let dayIdx = 0; dayIdx < this.daysInMonth; dayIdx++) {
        const attendanceCell = worksheet.getCell(row, dayIdx + 3);
        const hasAttended =
          dayIdx < student.attendance.length &&
          student.attendance[dayIdx] === true;
        attendanceCell.value = hasAttended ? "✓" : "";
        ExcelFormatters.styleAttendance(attendanceCell);
      }
    }
  }
}
