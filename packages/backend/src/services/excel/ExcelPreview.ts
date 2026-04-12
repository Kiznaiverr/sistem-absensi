/**
 * Excel Preview Generator
 * Generates HTML preview of attendance data
 */

import { ExportData } from "./ExcelGenerator.js";

export class ExcelPreview {
  /**
   * Generate HTML preview for single class
   */
  static generateSingleClassPreview(data: ExportData): string {
    const classData = data.classMatrices[0];
    return this.generateClassTable(classData, data);
  }

  /**
   * Generate HTML preview for all classes (tabs)
   */
  static generateMultiClassPreview(data: ExportData): string {
    const tabs = data.classMatrices
      .map((cm, idx) => {
        const id = `tab-${idx}`;
        const className = cm.class.name;
        return `<button class="preview-tab ${idx === 0 ? "active" : ""}" data-tab="${id}">${className}</button>`;
      })
      .join("");

    const contents = data.classMatrices
      .map((cm, idx) => {
        const id = `tab-${idx}`;
        return `
          <div class="preview-content ${idx === 0 ? "active" : ""}" id="${id}">
            ${this.generateClassTable(cm, data)}
          </div>
        `;
      })
      .join("");

    return `
      <div class="preview-tabs">
        ${tabs}
      </div>
      ${contents}
    `;
  }

  /**
   * Generate HTML table for a class
   */
  private static generateClassTable(
    classData: ExportData["classMatrices"][0],
    metadata: ExportData,
  ): string {
    const daysInMonth = 31;
    const headerCells = Array.from(
      { length: daysInMonth },
      (_, i) => `<th>${i + 1}</th>`,
    ).join("");

    const studentRows = classData.students
      .map(
        (student, idx) => `
        <tr>
          <td class="col-no">${idx + 1}</td>
          <td class="col-name">${student.name}</td>
          ${Array.from({ length: daysInMonth }, (_, dayIdx) => {
            const hasAttended =
              dayIdx < student.attendance.length &&
              student.attendance[dayIdx] === true;
            return `<td class="col-attendance">${hasAttended ? "✓" : ""}</td>`;
          }).join("")}
        </tr>
      `,
      )
      .join("");

    return `
      <div class="preview-info">
        <div class="preview-header">
          <h3>ABSENSI MADRASAH ${metadata.shift.toUpperCase()}</h3>
          <p>Bulan: ${metadata.monthName} ${metadata.year}</p>
          <p>Kelas: ${classData.class.name}</p>
        </div>
        <table class="preview-table">
          <thead>
            <tr>
              <th class="header-no">No</th>
              <th class="header-name">Nama</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${studentRows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Get CSS styles for preview
   */
  static getPreviewStyles(): string {
    return `
      <style>
        .preview-container {
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
          max-height: 600px;
          overflow-y: auto;
        }

        .preview-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 2px solid #e0e0e0;
        }

        .preview-tab {
          padding: 8px 16px;
          background: white;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
          color: #666;
        }

        .preview-tab.active {
          border-bottom-color: #2563eb;
          color: #2563eb;
        }

        .preview-tab:hover {
          background: #f9f9f9;
        }

        .preview-content {
          display: none;
        }

        .preview-content.active {
          display: block;
        }

        .preview-info {
          margin-bottom: 16px;
        }

        .preview-header {
          text-align: center;
          margin-bottom: 16px;
          padding: 12px;
          background: white;
          border-radius: 4px;
        }

        .preview-header h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #333;
        }

        .preview-header p {
          margin: 4px 0;
          font-size: 14px;
          color: #666;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 12px;
        }

        .preview-table th,
        .preview-table td {
          border: 1px solid #ddd;
          padding: 6px 4px;
          text-align: center;
        }

        .preview-table th {
          background: #f0f0f0;
          font-weight: bold;
          color: #333;
        }

        .preview-table tr:nth-child(even) {
          background: #fafafa;
        }

        .preview-table .col-no {
          width: 30px;
        }

        .preview-table .col-name {
          text-align: left;
          min-width: 150px;
        }

        .preview-table .col-attendance {
          padding: 4px 2px;
        }

        .preview-table .header-no {
          width: 30px;
        }

        .preview-table .header-name {
          text-align: left;
          min-width: 150px;
        }
      </style>
    `;
  }
}
