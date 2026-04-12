// Database Types
export type SchoolType = "SMP" | "SMK";
export type ClassGrade = 1 | 2 | 3;
export type Shift = "siang" | "malam";
export type AttendanceStatus = "present" | "absent";

// Classes
export interface Class {
  id: string;
  name: string;
  school_type: SchoolType;
  grade: ClassGrade;
  created_at: string;
}

// Santri (Student)
export interface Santri {
  id: string;
  rfid_id: string;
  name: string;
  class_id: string;
  is_active: boolean;
  created_at: string;
  class?: Class;
}

// Attendance Log
export interface AttendanceLog {
  id: string;
  santri_id: string;
  class_id: string;
  date: string;
  shift: Shift;
  checked_in_at: string;
  notes?: string;
  status: AttendanceStatus;
  created_at: string;
  santri?: Santri;
  class?: Class;
}

// Frontend Cache Types
export interface CachedSantri {
  rfid_id: string;
  santri_id: string;
  name: string;
  class_id: string;
  class_name: string;
  school_type: SchoolType;
  grade: ClassGrade;
  is_active: boolean;
}

export interface CachedAttendanceToday {
  date: string;
  siang: Set<string>; // rfid_ids yang sudah absen siang
  malam: Set<string>; // rfid_ids yang sudah absen malam
  records: AttendanceRecord[];
}

export interface AttendanceRecord {
  rfid_id: string;
  santri_id: string;
  name: string;
  class_name: string;
  school_type: SchoolType;
  shift: Shift;
  checked_in_at: number; // timestamp milliseconds
  status: "success" | "duplicate" | "error";
  message?: string;
  error_code?: string;
}

// API Request/Response Types
export interface BatchAttendanceRequest {
  batch: Array<{
    rfid_id: string;
    shift?: Shift; // Optional, akan auto-detect jika tidak ada
    timestamp: number;
  }>;
  date: string; // "2026-04-11"
}

export interface BatchAttendanceResponse {
  success: Array<{
    rfid_id: string;
    santri_id: string;
    name: string;
    class_name: string;
    school_type: SchoolType;
    shift: Shift;
    status: "present";
    already_checked: boolean;
    checked_in_at: string; // "14:35"
  }>;
  errors: Array<{
    rfid_id: string;
    shift?: Shift;
    error: string;
    error_code: string;
    already_checked_at?: string;
  }>;
}

// Export/Report Types
export interface ExportFilters {
  month?: number; // 0-11
  year?: number;
  school_type?: SchoolType;
  class_id?: string;
  class_name?: string;
  shift?: Shift;
  date_from?: string;
  date_to?: string;
}

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  metadata: {
    total_records: number;
    filters_applied: ExportFilters;
    generated_at: string;
  };
}

// Cache Entry
export interface CacheEntry<T> {
  data: T;
  expires_at: number;
  created_at: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  error_code: string;
  message: string;
  details?: Record<string, any>;
}

// Success Response
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}
