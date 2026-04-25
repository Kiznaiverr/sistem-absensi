/**
 * Santri Template Generator Service
 * Generates Excel template for import
 */

import ExcelJS from "exceljs";
import { FONT_STYLES, ALIGNMENT, BORDER_STYLES } from "./excel/ExcelStyles.js";

// Row number where actual data starts (after title, company, instructions, header, examples)
export const TEMPLATE_DATA_START_ROW = 8;

export class SantriTemplateService {
  /**
   * Generate template Excel workbook
   */
  static async generateTemplate(): Promise<ArrayBuffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Template");

      // Set column widths
      worksheet.columns = [
        { width: 5 }, // No
        { width: 25 }, // Nama Santri
        { width: 20 }, // RFID ID
        { width: 15 }, // Kelas
      ];

      let currentRow = 1;

      // Row 1: Title
      const titleCell = worksheet.getCell(currentRow, 1);
      titleCell.value = "TEMPLATE IMPORT DATA SANTRI";
      titleCell.font = FONT_STYLES.title;
      titleCell.alignment = ALIGNMENT.centerMiddle;
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      worksheet.getRow(currentRow).height = 25;
      currentRow++;

      // Row 2: Company name
      const companyCell = worksheet.getCell(currentRow, 1);
      companyCell.value = "PONDOK PESANTREN AL-KAHFI SOMALANGU";
      companyCell.font = FONT_STYLES.subtitle;
      companyCell.alignment = ALIGNMENT.centerMiddle;
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      worksheet.getRow(currentRow).height = 18;
      currentRow++;

      // Row 3: Instructions
      const instructionCell = worksheet.getCell(currentRow, 1);
      instructionCell.value =
        "Petunjuk: Isi data santri baru pada baris di bawah. Jangan menghapus atau mengubah header row.";
      instructionCell.font = { ...FONT_STYLES.body, italic: true };
      instructionCell.alignment = { ...ALIGNMENT.leftCenter, wrapText: true };
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      worksheet.getRow(currentRow).height = 35;
      currentRow++;

      // Empty row for spacing
      currentRow++;

      // Row 5: Headers
      const headerRow = worksheet.getRow(currentRow);
      headerRow.height = 20;

      const noHeader = worksheet.getCell(currentRow, 1);
      noHeader.value = "No";
      this.styleHeader(noHeader);

      const nameHeader = worksheet.getCell(currentRow, 2);
      nameHeader.value = "Nama Santri";
      this.styleHeader(nameHeader);

      const rfidHeader = worksheet.getCell(currentRow, 3);
      rfidHeader.value = "RFID ID";
      this.styleHeader(rfidHeader);

      const classHeader = worksheet.getCell(currentRow, 4);
      classHeader.value = "Nama Kelas";
      this.styleHeader(classHeader);

      currentRow++;

      // Example rows (first 2 rows as examples)
      this.addExampleRow(
        worksheet,
        currentRow,
        1,
        "Ahmad Rizki",
        "1A2B3C4D5E6F",
        "SMK-1",
      );
      currentRow++;

      this.addExampleRow(
        worksheet,
        currentRow,
        2,
        "Siti Nur Azizah",
        "2B3C4D5E6F1A",
        "SMP-2",
      );
      currentRow++;

      // Add 48 more empty rows for data entry (50 rows total)
      for (let i = 3; i <= 50; i++) {
        this.addEmptyRow(worksheet, currentRow, i);
        currentRow++;
      }

      // Generate buffer
      return (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
    } catch (error) {
      console.error("Error generating template", error);
      throw error;
    }
  }

  /**
   * Style header cell
   */
  private static styleHeader(cell: ExcelJS.Cell): void {
    cell.font = FONT_STYLES.header;
    cell.alignment = ALIGNMENT.centerMiddle;
    cell.border = BORDER_STYLES.thin;
  }

  /**
   * Add example row
   */
  private static addExampleRow(
    worksheet: ExcelJS.Worksheet,
    rowNum: number,
    no: number,
    name: string,
    rfid: string,
    className: string,
  ): void {
    const row = worksheet.getRow(rowNum);
    row.height = 18;

    const noCell = worksheet.getCell(rowNum, 1);
    noCell.value = no;
    noCell.font = FONT_STYLES.body;
    noCell.alignment = ALIGNMENT.centerMiddle;
    noCell.border = BORDER_STYLES.thin;

    const nameCell = worksheet.getCell(rowNum, 2);
    nameCell.value = name;
    nameCell.font = FONT_STYLES.body;
    nameCell.alignment = ALIGNMENT.leftCenter;
    nameCell.border = BORDER_STYLES.thin;

    const rfidCell = worksheet.getCell(rowNum, 3);
    rfidCell.value = rfid;
    rfidCell.font = FONT_STYLES.body;
    rfidCell.alignment = ALIGNMENT.leftCenter;
    rfidCell.border = BORDER_STYLES.thin;

    const classCell = worksheet.getCell(rowNum, 4);
    classCell.value = className;
    classCell.font = FONT_STYLES.body;
    classCell.alignment = ALIGNMENT.leftCenter;
    classCell.border = BORDER_STYLES.thin;
  }

  /**
   * Add empty row for data entry
   */
  private static addEmptyRow(
    worksheet: ExcelJS.Worksheet,
    rowNum: number,
    no: number,
  ): void {
    const row = worksheet.getRow(rowNum);
    row.height = 18;

    const noCell = worksheet.getCell(rowNum, 1);
    noCell.value = no;
    noCell.font = FONT_STYLES.body;
    noCell.alignment = ALIGNMENT.centerMiddle;
    noCell.border = BORDER_STYLES.thin;

    for (let col = 2; col <= 4; col++) {
      const cell = worksheet.getCell(rowNum, col);
      cell.border = BORDER_STYLES.thin;
      cell.alignment = ALIGNMENT.leftCenter;
    }
  }
}
