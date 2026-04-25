/**
 * Database Service Layer
 * Handles all Supabase operations
 */

import { supabaseClient } from "../config/database.js";
import { Santri, Class, AttendanceLog, Shift } from "@absensi/shared/types";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("DatabaseService");
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SantriImportJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress_percent: number;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  stage: string | null;
  message: string | null;
  file_name: string;
  file_path: string;
  created_by: string | null;
  created_by_email: string | null;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SantriImportJobError {
  id: number;
  job_id: string;
  row_number: number;
  name: string;
  rfid_id: string;
  class_name: string;
  error_type: string;
  message: string;
  severity: "error" | "warning";
  created_at: string;
}

export class DatabaseService {
  /**
   * Get all classes
   */
  static async getClasses(): Promise<Class[]> {
    try {
      const { data, error } = await supabaseClient
        .from("classes")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get classes", error);
      throw error;
    }
  }

  /**
   * Get santri by RFID ID
   */
  static async getSantriByRFID(rfidId: string): Promise<Santri | null> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .select("*, classes(*)")
        .eq("rfid_id", rfidId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data || null;
    } catch (error) {
      logger.error("Failed to get santri by RFID", { rfidId, error });
      throw error;
    }
  }

  /**
   * Get santri by class ID
   */
  static async getSantriByClass(classId: string): Promise<Santri[]> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .select("*, classes(*)")
        .eq("class_id", classId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get santri by class", { classId, error });
      throw error;
    }
  }

  /**
   * Record attendance
   */
  static async recordAttendance(
    santriId: string,
    classId: string,
    date: string,
    shift: Shift,
  ): Promise<AttendanceLog> {
    try {
      const { data, error } = await supabaseClient
        .from("attendance_logs")
        .insert({
          santri_id: santriId,
          class_id: classId,
          date,
          shift,
          status: "present",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error("Failed to record attendance", {
        santriId,
        classId,
        date,
        shift,
        error,
      });
      throw error;
    }
  }

  /**
   * Get attendance records for today (for cache initialization)
   * Returns rfid_id, shift for duplicate checking
   */
  static async getAttendanceTodayRecords(
    date: string,
  ): Promise<{ rfid_id: string; shift: Shift }[]> {
    try {
      const { data, error } = await supabaseClient
        .from("attendance_logs")
        .select("santri(rfid_id), shift")
        .eq("date", date);

      if (error) throw error;

      // Map to simple format for cache
      return (
        data?.map((record: any) => ({
          rfid_id: record.santri?.rfid_id || "",
          shift: record.shift,
        })) || []
      );
    } catch (error) {
      logger.error("Failed to get today's attendance records", { date, error });
      throw error;
    }
  }

  /**
   * Get attendance logs for a date
   */
  static async getAttendanceByDate(date: string): Promise<AttendanceLog[]> {
    try {
      const { data, error } = await supabaseClient
        .from("attendance_logs")
        .select("*, santri(*), classes(*)")
        .eq("date", date)
        .order("checked_in_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get attendance by date", { date, error });
      throw error;
    }
  }

  /**
   * Get attendance logs for a month
   */
  static async getAttendanceByMonth(
    year: number,
    month: number,
  ): Promise<AttendanceLog[]> {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabaseClient
        .from("attendance_logs")
        .select("*, santri(*), classes(*)")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("checked_in_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get attendance by month", { year, month, error });
      throw error;
    }
  }

  /**
   * Get attendance with filters
   */
  static async getAttendanceWithFilters(filters: {
    month?: number;
    year?: number;
    school_type?: string;
    class_id?: string;
    shift?: Shift;
    date_from?: string;
    date_to?: string;
  }): Promise<AttendanceLog[]> {
    try {
      let query = supabaseClient
        .from("attendance_logs")
        .select("*, santri(*), classes(*)");

      if (filters.date_from) {
        query = query.gte("date", filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte("date", filters.date_to);
      }
      if (filters.class_id) {
        query = query.eq("class_id", filters.class_id);
      }
      if (filters.shift) {
        query = query.eq("shift", filters.shift);
      }
      if (filters.school_type) {
        query = query.eq("classes.school_type", filters.school_type);
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get attendance with filters", { filters, error });
      throw error;
    }
  }

  /**
   * Get attendance count summary
   */
  static async getAttendanceSummary(date: string): Promise<{
    siang_count: number;
    malam_count: number;
    total: number;
  }> {
    try {
      const [siangResult, malamResult] = await Promise.all([
        supabaseClient
          .from("attendance_logs")
          .select("id")
          .eq("date", date)
          .eq("shift", "siang"),
        supabaseClient
          .from("attendance_logs")
          .select("id")
          .eq("date", date)
          .eq("shift", "malam"),
      ]);

      const siang_count = siangResult.data?.length || 0;
      const malam_count = malamResult.data?.length || 0;

      return {
        siang_count,
        malam_count,
        total: siang_count + malam_count,
      };
    } catch (error) {
      logger.error("Failed to get attendance summary", { date, error });
      throw error;
    }
  }

  /**
   * Get data for export: classes, santri, and attendance records for a date range
   * Queries BOTH active and archive tables to ensure complete data
   */
  static async getExportData(
    month: number,
    year: number,
    shift: "siang" | "malam",
    school_type?: string,
    class_id?: string,
  ): Promise<{
    classes: any[];
    santri: any[];
    attendance_logs: any[];
    source: "active" | "archive" | "both";
  }> {
    try {
      // Get classes
      let classQuery = supabaseClient.from("classes").select("*");

      if (school_type) {
        classQuery = classQuery.eq("school_type", school_type);
      }

      // Handle class_id: can be either an exact ID or a class number
      if (class_id) {
        // Check if class_id is a number (e.g., "2" for Kelas 2)
        if (/^\d+$/.test(class_id)) {
          // It's a class number, filter by name pattern (e.g., "-2" or "2")
          classQuery = classQuery.like("name", `%-${class_id}%`);
        } else {
          // It's an exact ID
          classQuery = classQuery.eq("id", class_id);
        }
      }

      const { data: classesData, error: classError } = await classQuery.order(
        "name",
        { ascending: true },
      );
      if (classError) throw classError;

      // Get santri for these classes
      let santriData: any[] = [];

      if (classesData && classesData.length > 0) {
        const classIds = (classesData as any[]).map((c) => c.id);
        let santriQuery = supabaseClient
          .from("santri")
          .select("*")
          .eq("is_active", true)
          .in("class_id", classIds);

        const { data, error: santriError } = await santriQuery.order("name", {
          ascending: true,
        });
        if (santriError) throw santriError;
        santriData = data || [];
      }

      // Get attendance logs for the month
      let attendanceData: any[] = [];
      let dataSource: "active" | "archive" | "both" = "active";

      if (classesData && classesData.length > 0) {
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // Last day of month
        const classIds = (classesData as any[]).map((c) => c.id);

        // Query from ACTIVE table
        let activeQuery = supabaseClient
          .from("attendance_logs")
          .select("*, santri(*), classes(*)")
          .gte("date", startDate)
          .lte("date", endDate)
          .eq("shift", shift);

        if (classIds.length === 1) {
          activeQuery = activeQuery.eq("class_id", classIds[0]);
        } else {
          activeQuery = activeQuery.in("class_id", classIds);
        }

        const { data: activeData, error: activeError } = await activeQuery;
        if (activeError) throw activeError;

        // Query from ARCHIVE table
        let archiveQuery = supabaseClient
          .from("attendance_logs_archive")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .eq("shift", shift)
          .in("class_id", classIds);

        const { data: archiveData, error: archiveError } = await archiveQuery;
        if (archiveError) throw archiveError;

        // Normalize archive data to match active format
        const normalizedArchiveData = (archiveData || []).map(
          (record: any) => ({
            id: record.id,
            santri_id: record.santri_id,
            class_id: record.class_id,
            date: record.date,
            shift: record.shift,
            checked_in_at: record.checked_in_at,
            status: record.status,
            notes: record.notes,
            created_at: record.original_created_at,
            santri: {
              id: record.santri_id,
              name: record.santri_name,
              rfid_id: record.santri_rfid_id,
              class_id: record.class_id,
            },
            classes: {
              id: record.class_id,
              name: record.class_name,
              school_type: record.school_type,
              grade: record.grade,
            },
          }),
        );

        // Combine both datasets, deduplicating by id
        const dataMap = new Map();

        // Add active data first
        (activeData || []).forEach((record: any) => {
          dataMap.set(record.id, record);
        });

        // Add archive data (won't overwrite if same id exists in active)
        normalizedArchiveData.forEach((record: any) => {
          if (!dataMap.has(record.id)) {
            dataMap.set(record.id, record);
          }
        });

        attendanceData = Array.from(dataMap.values());

        // Determine data source
        if (
          activeData &&
          activeData.length > 0 &&
          (!archiveData || archiveData.length === 0)
        ) {
          dataSource = "active";
        } else if (
          (!activeData || activeData.length === 0) &&
          archiveData &&
          archiveData.length > 0
        ) {
          dataSource = "archive";
        } else if (
          activeData &&
          activeData.length > 0 &&
          archiveData &&
          archiveData.length > 0
        ) {
          dataSource = "both";
        }
      }

      logger.info("Export data fetched", {
        month,
        year,
        total_records: attendanceData.length,
        source: dataSource,
      });

      return {
        classes: classesData || [],
        santri: santriData || [],
        attendance_logs: attendanceData,
        source: dataSource,
      };
    } catch (error) {
      logger.error("Failed to get export data", {
        month,
        year,
        shift,
        school_type,
        class_id,
        error,
      });
      throw error;
    }
  }

  /**
   * Count active records in attendance_logs table
   */
  static async countActiveRecords(): Promise<number> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_logs")
        .select("id", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error("Failed to count active records", error);
      throw error;
    }
  }

  /**
   * Count archived records in attendance_logs_archive table
   */
  static async countArchivedRecords(): Promise<number> {
    try {
      const { count, error } = await supabaseClient
        .from("attendance_logs_archive")
        .select("id", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error("Failed to count archived records", error);
      throw error;
    }
  }

  /**
   * Get oldest record in active table
   */
  static async getOldestActiveRecord(): Promise<string | null> {
    try {
      const { data, error } = await supabaseClient
        .from("attendance_logs")
        .select("date")
        .order("date", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data?.date || null;
    } catch (error) {
      logger.error("Failed to get oldest active record", error);
      return null;
    }
  }

  /**
   * Find admin by email or username
   */
  static async findAdminByEmailOrUsername(
    emailOrUsername: string,
  ): Promise<any | null> {
    try {
      const { data, error } = await supabaseClient
        .from("admins")
        .select("*")
        .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data || null;
    } catch (error) {
      logger.error("Failed to find admin by email/username", {
        emailOrUsername,
        error,
      });
      throw error;
    }
  }

  /**
   * Update admin last login timestamp
   */
  static async updateAdminLastLogin(adminId: string): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from("admins")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", adminId);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to update admin last login", { adminId, error });
      // Don't throw - this is not critical
    }
  }

  /**
   * Get available months and years with attendance data
   * Returns months/years that have attendance records
   */
  static async getAvailableMonths(
    shift: "siang" | "malam",
  ): Promise<{ years: number[]; months_by_year: Record<number, number[]> }> {
    try {
      // Get unique dates from active table
      const { data: activeData, error: activeError } = await supabaseClient
        .from("attendance_logs")
        .select("date")
        .eq("shift", shift);

      if (activeError) throw activeError;

      // Get unique dates from archive table
      const { data: archiveData, error: archiveError } = await supabaseClient
        .from("attendance_logs_archive")
        .select("date")
        .eq("shift", shift);

      if (archiveError) throw archiveError;

      // Combine and extract unique months/years
      const allDates = [...(activeData || []), ...(archiveData || [])];
      const monthYearSet = new Set<string>();

      for (const record of allDates) {
        if (record.date) {
          const dateObj = new Date(record.date);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth() + 1; // 1-12
          monthYearSet.add(`${year}-${String(month).padStart(2, "0")}`);
        }
      }

      // Parse and organize by year
      const monthsByYear: Record<number, number[]> = {};
      for (const monthYearStr of monthYearSet) {
        const [yearStr, monthStr] = monthYearStr.split("-");
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        if (!monthsByYear[year]) {
          monthsByYear[year] = [];
        }
        if (!monthsByYear[year].includes(month)) {
          monthsByYear[year].push(month);
        }
      }

      // Sort months for each year
      const years = Object.keys(monthsByYear)
        .map(Number)
        .sort((a, b) => b - a); // Descending order
      for (const year of years) {
        monthsByYear[year].sort((a, b) => a - b);
      }

      logger.info("Available months fetched", {
        shift,
        years,
        total_months: monthYearSet.size,
      });

      return {
        years,
        months_by_year: monthsByYear,
      };
    } catch (error) {
      logger.error("Failed to get available months", { shift, error });
      throw error;
    }
  }

  /**
   * Create new santri
   */
  static async createSantri(
    name: string,
    rfidId: string,
    classId: string,
  ): Promise<Santri> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .insert({
          name,
          rfid_id: rfidId,
          class_id: classId,
          is_active: true,
        })
        .select("*, classes(*)")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error("Failed to create santri", { name, rfidId, classId, error });
      throw error;
    }
  }

  /**
   * Bulk create santri (batch insert)
   */
  static async bulkCreateSantri(
    santris: Array<{ name: string; rfid_id: string; class_id: string }>,
  ): Promise<number> {
    if (santris.length === 0) return 0;

    try {
      const { error } = await supabaseClient.from("santri").insert(
        santris.map((s) => ({
          name: s.name,
          rfid_id: s.rfid_id,
          class_id: s.class_id,
          is_active: true,
        })),
      );

      if (error) throw error;
      return santris.length;
    } catch (error) {
      logger.error("Failed to bulk create santri", {
        count: santris.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all santri with optional filters
   */
  static async getAllSantri(filters?: {
    classId?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<Santri[]> {
    try {
      let query = supabaseClient
        .from("santri")
        .select("*, classes(*)")
        .order("name", { ascending: true });

      if (filters?.classId) {
        query = query.eq("class_id", filters.classId);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      // Search by name or RFID
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,rfid_id.ilike.%${filters.search}%`,
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error("Failed to get all santri", { filters, error });
      throw error;
    }
  }

  /**
   * Get santri by ID
   */
  static async getSantriById(santriId: string): Promise<Santri | null> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .select("*, classes(*)")
        .eq("id", santriId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data || null;
    } catch (error) {
      logger.error("Failed to get santri by ID", { santriId, error });
      throw error;
    }
  }

  /**
   * Update santri
   */
  static async updateSantri(
    santriId: string,
    updates: {
      name?: string;
      classId?: string;
      isActive?: boolean;
    },
  ): Promise<Santri> {
    try {
      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.classId) updateData.class_id = updates.classId;
      if (updates.isActive !== undefined)
        updateData.is_active = updates.isActive;

      const { data, error } = await supabaseClient
        .from("santri")
        .update(updateData)
        .eq("id", santriId)
        .select("*, classes(*)")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error("Failed to update santri", { santriId, updates, error });
      throw error;
    }
  }

  /**
   * Update santri RFID
   * Special method to handle RFID updates with validation
   */
  static async updateSantriRFID(
    santriId: string,
    newRfidId: string,
  ): Promise<Santri> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .update({ rfid_id: newRfidId })
        .eq("id", santriId)
        .select("*, classes(*)")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error("Failed to update santri RFID", {
        santriId,
        newRfidId,
        error,
      });
      throw error;
    }
  }

  /**
   * Soft delete santri
   * Sets is_active = false instead of hard delete
   */
  static async deleteSantri(santriId: string): Promise<Santri> {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .update({ is_active: false })
        .eq("id", santriId)
        .select("*, classes(*)")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error("Failed to delete santri", { santriId, error });
      throw error;
    }
  }

  /**
   * Check if RFID already exists (for validation)
   */
  static async checkRFIDExists(
    rfidId: string,
    excludeSantriId?: string,
  ): Promise<boolean> {
    try {
      let query = supabaseClient
        .from("santri")
        .select("id")
        .eq("rfid_id", rfidId);

      if (excludeSantriId) {
        query = query.neq("id", excludeSantriId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      logger.error("Failed to check RFID exists", { rfidId, error });
      throw error;
    }
  }

  /**
   * Get all existing RFID IDs for a given list
   */
  static async getExistingRFIDs(rfidIds: string[]): Promise<Set<string>> {
    try {
      const uniqueRFIDs = Array.from(new Set(rfidIds.filter(Boolean)));
      if (uniqueRFIDs.length === 0) {
        return new Set();
      }

      const existingRFIDs = new Set<string>();
      const chunkSize = 500;

      for (let i = 0; i < uniqueRFIDs.length; i += chunkSize) {
        const chunk = uniqueRFIDs.slice(i, i + chunkSize);
        const { data, error } = await supabaseClient
          .from("santri")
          .select("rfid_id")
          .in("rfid_id", chunk);

        if (error) throw error;

        for (const row of data || []) {
          if (row.rfid_id) {
            existingRFIDs.add(row.rfid_id);
          }
        }
      }

      return existingRFIDs;
    } catch (error) {
      logger.error("Failed to get existing RFIDs", { rfidIds, error });
      throw error;
    }
  }

  /**
   * Create santri import background job
   */
  static async createSantriImportJob(input: {
    fileName: string;
    filePath: string;
    createdBy?: string;
    createdByEmail?: string;
  }): Promise<SantriImportJob> {
    try {
      const { data, error } = await supabaseClient
        .from("santri_import_jobs")
        .insert({
          status: "queued",
          file_name: input.fileName,
          file_path: input.filePath,
          created_by: input.createdBy || null,
          created_by_email: input.createdByEmail || null,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as SantriImportJob;
    } catch (error) {
      logger.error("Failed to create santri import job", { input, error });
      throw error;
    }
  }

  /**
   * Get santri import job by id
   */
  static async getSantriImportJobById(
    jobId: string,
  ): Promise<SantriImportJob | null> {
    try {
      if (!UUID_V4_PATTERN.test(jobId)) {
        return null;
      }

      const { data, error } = await supabaseClient
        .from("santri_import_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return (data as SantriImportJob) || null;
    } catch (error) {
      logger.error("Failed to get santri import job", { jobId, error });
      throw error;
    }
  }

  /**
   * Claim next queued import job for processing
   */
  static async claimNextQueuedSantriImportJob(): Promise<SantriImportJob | null> {
    try {
      const { data: nextJob, error: nextJobError } = await supabaseClient
        .from("santri_import_jobs")
        .select("id")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextJobError) throw nextJobError;
      if (!nextJob?.id) return null;

      const { data: claimedJob, error: claimError } = await supabaseClient
        .from("santri_import_jobs")
        .update({
          status: "processing",
          stage: "parsing",
          message: "Job diproses di background",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextJob.id)
        .eq("status", "queued")
        .select("*")
        .maybeSingle();

      if (claimError) throw claimError;
      return (claimedJob as SantriImportJob) || null;
    } catch (error) {
      logger.error("Failed to claim queued import job", error);
      throw error;
    }
  }

  /**
   * Update import job progress
   */
  static async updateSantriImportJobProgress(
    jobId: string,
    progress: {
      stage?: string;
      message?: string;
      progressPercent?: number;
      totalRows?: number;
      processedRows?: number;
      successCount?: number;
      errorCount?: number;
    },
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (progress.stage !== undefined) payload.stage = progress.stage;
      if (progress.message !== undefined) payload.message = progress.message;
      if (progress.progressPercent !== undefined) {
        payload.progress_percent = Math.max(
          0,
          Math.min(100, progress.progressPercent),
        );
      }
      if (progress.totalRows !== undefined)
        payload.total_rows = progress.totalRows;
      if (progress.processedRows !== undefined)
        payload.processed_rows = progress.processedRows;
      if (progress.successCount !== undefined)
        payload.success_count = progress.successCount;
      if (progress.errorCount !== undefined)
        payload.error_count = progress.errorCount;

      const { error } = await supabaseClient
        .from("santri_import_jobs")
        .update(payload)
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to update import job progress", { jobId, error });
      throw error;
    }
  }

  /**
   * Save import row errors for a job
   */
  static async saveSantriImportJobErrors(
    jobId: string,
    errors: Array<{
      row: number;
      name: string;
      rfid_id: string;
      class_name: string;
      error_type: string;
      message: string;
      severity: "error" | "warning";
    }>,
  ): Promise<void> {
    try {
      if (errors.length === 0) return;

      const rows = errors.map((item) => ({
        job_id: jobId,
        row_number: item.row,
        name: item.name || "",
        rfid_id: item.rfid_id || "",
        class_name: item.class_name || "",
        error_type: item.error_type,
        message: item.message,
        severity: item.severity,
      }));

      const { error } = await supabaseClient
        .from("santri_import_errors")
        .insert(rows);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to save import job errors", { jobId, error });
      throw error;
    }
  }

  /**
   * Mark import job as completed and schedule expiry
   */
  static async completeSantriImportJob(
    jobId: string,
    summary: {
      totalRows: number;
      processedRows: number;
      successCount: number;
      errorCount: number;
      message: string;
      ttlMinutes?: number;
    },
  ): Promise<void> {
    try {
      const now = new Date();
      const ttlMs = (summary.ttlMinutes ?? 5) * 60 * 1000;
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      const { error } = await supabaseClient
        .from("santri_import_jobs")
        .update({
          status: "completed",
          stage: "completed",
          message: summary.message,
          progress_percent: 100,
          total_rows: summary.totalRows,
          processed_rows: summary.processedRows,
          success_count: summary.successCount,
          error_count: summary.errorCount,
          finished_at: now.toISOString(),
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to complete import job", { jobId, error });
      throw error;
    }
  }

  /**
   * Mark import job as failed and schedule expiry
   */
  static async failSantriImportJob(
    jobId: string,
    message: string,
    ttlMinutes = 5,
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

      const { error } = await supabaseClient
        .from("santri_import_jobs")
        .update({
          status: "failed",
          stage: "error",
          message,
          finished_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to fail import job", { jobId, error });
      throw error;
    }
  }

  /**
   * List errors for import job
   */
  static async getSantriImportJobErrors(
    jobId: string,
  ): Promise<SantriImportJobError[]> {
    try {
      if (!UUID_V4_PATTERN.test(jobId)) {
        return [];
      }

      const { data, error } = await supabaseClient
        .from("santri_import_errors")
        .select("*")
        .eq("job_id", jobId)
        .order("row_number", { ascending: true });

      if (error) throw error;
      return (data as SantriImportJobError[]) || [];
    } catch (error) {
      logger.error("Failed to get import job errors", { jobId, error });
      throw error;
    }
  }

  /**
   * Get expired import jobs for cleanup
   */
  static async getExpiredSantriImportJobs(
    limit = 200,
  ): Promise<SantriImportJob[]> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabaseClient
        .from("santri_import_jobs")
        .select("*")
        .in("status", ["completed", "failed"])
        .not("expires_at", "is", null)
        .lt("expires_at", now)
        .order("expires_at", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data as SantriImportJob[]) || [];
    } catch (error) {
      logger.error("Failed to get expired import jobs", error);
      throw error;
    }
  }

  /**
   * Delete import jobs by id (errors table deleted via cascade)
   */
  static async deleteSantriImportJobs(jobIds: string[]): Promise<void> {
    try {
      if (jobIds.length === 0) return;

      const { error } = await supabaseClient
        .from("santri_import_jobs")
        .delete()
        .in("id", jobIds);

      if (error) throw error;
    } catch (error) {
      logger.error("Failed to delete import jobs", { jobIds, error });
      throw error;
    }
  }
}
