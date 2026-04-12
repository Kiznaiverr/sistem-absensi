/**
 * Excel Cell Formatting Utilities
 */

import ExcelJS from "exceljs";
import {
  FONT_STYLES,
  ALIGNMENT,
  BORDER_STYLES,
  COLUMN_WIDTHS,
} from "./ExcelStyles";

export class ExcelFormatters {
  /**
   * Apply thin borders to a cell
   */
  static addBorder(cell: ExcelJS.Cell) {
    cell.border = BORDER_STYLES.thin;
  }

  /**
   * Remove borders from a cell
   */
  static removeBorder(cell: ExcelJS.Cell) {
    cell.border = BORDER_STYLES.none;
  }

  /**
   * Style a title cell (row 1)
   */
  static styleTitle(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.title;
    cell.alignment = ALIGNMENT.centerMiddle;
    this.removeBorder(cell);
  }

  /**
   * Style a subtitle cell (row 2)
   */
  static styleSubtitle(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.subtitle;
    cell.alignment = ALIGNMENT.centerMiddle;
    this.removeBorder(cell);
  }

  /**
   * Style an info cell (month/class info)
   */
  static styleInfo(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.info;
    cell.alignment = ALIGNMENT.left;
    this.removeBorder(cell);
  }

  /**
   * Style a header cell (No, Nama, Tanggal)
   */
  static styleHeader(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.header;
    cell.alignment = ALIGNMENT.centerCenter;
    this.addBorder(cell);
  }

  /**
   * Style a date number cell
   */
  static styleDate(cell: ExcelJS.Cell) {
    cell.numFmt = "0";
    cell.font = FONT_STYLES.header;
    cell.alignment = ALIGNMENT.centerCenter;
    this.addBorder(cell);
  }

  /**
   * Style a student name cell
   */
  static styleName(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.body;
    cell.alignment = ALIGNMENT.leftCenter;
    this.addBorder(cell);
  }

  /**
   * Style a student number cell
   */
  static styleNumber(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.body;
    cell.alignment = ALIGNMENT.centerCenter;
    this.addBorder(cell);
  }

  /**
   * Style an attendance cell (with checkmark)
   */
  static styleAttendance(cell: ExcelJS.Cell) {
    cell.font = FONT_STYLES.body;
    cell.alignment = ALIGNMENT.centerCenter;
    this.addBorder(cell);
  }

  /**
   * Set column widths for a worksheet
   */
  static setColumnWidths(worksheet: ExcelJS.Worksheet, daysInMonth: number) {
    worksheet.getColumn(1).width = COLUMN_WIDTHS.NO;
    worksheet.getColumn(2).width = COLUMN_WIDTHS.NAME;
    for (let i = 3; i <= daysInMonth + 2; i++) {
      worksheet.getColumn(i).width = COLUMN_WIDTHS.DATE;
    }
  }

  /**
   * Get column letter from index (1-based)
   */
  static getColumnLetter(index: number): string {
    let letter = "";
    while (index > 0) {
      index--;
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26);
    }
    return letter;
  }

  /**
   * Get cell range for merging (e.g., "A1:AG1")
   */
  static getCellRange(startCol: number, endCol: number, row: number): string {
    const startLetter = this.getColumnLetter(startCol);
    const endLetter = this.getColumnLetter(endCol);
    return `${startLetter}${row}:${endLetter}${row}`;
  }
}
