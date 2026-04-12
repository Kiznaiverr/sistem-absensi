/**
 * Export Service
 * Builds attendance matrices for export - returns raw JSON only
 */

import { Class, Santri, AttendanceLog } from "../../shared/types";

interface ClassMatrix {
  class: {
    name: string;
  };
  students: Array<{
    name: string;
    attendance: boolean[];
  }>;
  dates: number[];
}

export class ExportService {
  /**
   * Build class matrix from attendance data
   * Returns only: class name, student names, attendance array, dates
   */
  static buildClassMatrix(
    classData: Class,
    santriInClass: Santri[],
    attendanceRecords: AttendanceLog[],
    daysInMonth: number,
    shift: "siang" | "malam",
  ): ClassMatrix {
    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    // Map attendance by santri_id and date
    const attendanceMap = new Map<string, Set<number>>();
    for (const record of attendanceRecords) {
      if (record.shift === shift) {
        const dateObj = new Date(record.date as any);
        const day = dateObj.getDate();
        if (!attendanceMap.has(record.santri_id)) {
          attendanceMap.set(record.santri_id, new Set());
        }
        attendanceMap.get(record.santri_id)!.add(day);
      }
    }

    // Build matrix
    const matrix: ClassMatrix = {
      class: {
        name: classData.name,
      },
      students: [],
      dates,
    };

    // Add students
    for (const santri of santriInClass) {
      const attendance = dates.map((day) => {
        return attendanceMap.get(santri.id)?.has(day) || false;
      });

      matrix.students.push({
        name: santri.name,
        attendance,
      });
    }

    return matrix;
  }
}
