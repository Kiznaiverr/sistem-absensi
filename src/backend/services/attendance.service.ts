/**
 * Attendance Service
 * Core business logic for attendance processing
 * Handles: validation, caching, duplicate checking, shift detection
 */

import {
  Shift,
  BatchAttendanceRequest,
  BatchAttendanceResponse,
  CachedSantri,
} from "../../shared/types";
import { DatabaseService } from "./database.service";
import { cacheService } from "./cache.service";
import { createLogger } from "../utils/logger";
import {
  detectShift,
  isShiftActive,
  getCurrentDateString,
  formatTime,
} from "../utils/time";
import { validateRFIDId } from "../utils/validators";
import { ERROR_CODES, ERROR_MESSAGES } from "../config/constants";
import env from "../config/env";

const logger = createLogger("AttendanceService");

interface CachedAttendanceToday {
  date: string;
  siang: Map<string, number>; // rfid_id -> timestamp
  malam: Map<string, number>; // rfid_id -> timestamp
}

export class AttendanceService {
  private static readonly CACHE_KEY_CLASSES = "classes:all";
  private static readonly CACHE_KEY_ATTENDANCE_TODAY = "attendance:today";

  /**
   * Initialize cache with santri data from database
   */
  static async initializeCache(): Promise<void> {
    try {
      logger.info("Initializing cache...");

      // Load all classes
      const classes = await DatabaseService.getClasses();
      cacheService.set(this.CACHE_KEY_CLASSES, classes, env.CACHE_TTL_SANTRI);
      logger.info("Cached classes", { count: classes.length });

      // Load santri per class
      for (const classItem of classes) {
        const santri = await DatabaseService.getSantriByClass(classItem.id);
        const cacheKey = `santri:class:${classItem.id}`;
        cacheService.set(cacheKey, santri, env.CACHE_TTL_SANTRI);
        logger.info("Cached santri for class", {
          class: classItem.name,
          count: santri.length,
        });
      }

      // Initialize attendance today
      await this.initializeAttendanceTodayCache();

      logger.info("Cache initialization complete");
    } catch (error) {
      logger.error("Failed to initialize cache", error);
      throw error;
    }
  }

  /**
   * Initialize today's attendance cache
   * Load existing attendance records from DB to sync with cache
   */
  private static async initializeAttendanceTodayCache(): Promise<void> {
    const today = getCurrentDateString();
    const attendanceToday: CachedAttendanceToday = {
      date: today,
      siang: new Map(),
      malam: new Map(),
    };

    try {
      // Query existing records from DB for today
      const existingRecords =
        await DatabaseService.getAttendanceTodayRecords(today);

      // Load into cache
      for (const record of existingRecords) {
        if (record.rfid_id && record.shift) {
          const map =
            record.shift === "siang"
              ? attendanceToday.siang
              : attendanceToday.malam;
          // Use current timestamp as placeholder
          map.set(record.rfid_id, Date.now());
        }
      }

      logger.info("Attendance cache initialized", {
        date: today,
        siang_count: attendanceToday.siang.size,
        malam_count: attendanceToday.malam.size,
      });
    } catch (error) {
      logger.error("Failed to initialize attendance cache", error);
      // Continue with empty cache instead of failing
    }

    cacheService.set(
      this.CACHE_KEY_ATTENDANCE_TODAY,
      attendanceToday,
      env.CACHE_TTL_ATTENDANCE,
    );
  }

  /**
   * Get cached santri by RFID ID
   * Falls back to database if not in cache
   */
  static async getSantriByRFID(rfidId: string): Promise<CachedSantri | null> {
    try {
      // Try to find in cache first
      const classes = cacheService.get<any[]>(this.CACHE_KEY_CLASSES);

      if (classes && env.CACHE_ENABLED) {
        for (const classItem of classes) {
          const santriList = cacheService.get<any[]>(
            `santri:class:${classItem.id}`,
          );
          if (santriList) {
            const santri = santriList.find((s) => s.rfid_id === rfidId);
            if (santri) {
              return this.mapSantriToCache(santri, classItem);
            }
          }
        }
      }

      // Fall back to database
      const santri = await DatabaseService.getSantriByRFID(rfidId);
      if (!santri) return null;

      // Cache it for next time
      if (env.CACHE_ENABLED) {
        const classItem = santri.class;
        if (classItem) {
          const cacheKey = `santri:class:${classItem.id}`;
          const cachedList = cacheService.get<any[]>(cacheKey) || [];
          if (!cachedList.find((s) => s.rfid_id === rfidId)) {
            cachedList.push(santri);
            cacheService.set(cacheKey, cachedList, env.CACHE_TTL_SANTRI);
          }
        }
      }

      return this.mapSantriToCache(santri, santri.class);
    } catch (error) {
      logger.error("Failed to get santri by RFID", { rfidId, error });
      throw error;
    }
  }

  /**
   * Map database santri to cache format
   */
  private static mapSantriToCache(santri: any, classData: any): CachedSantri {
    return {
      rfid_id: santri.rfid_id,
      santri_id: santri.id,
      name: santri.name,
      class_id: santri.class_id,
      class_name: classData?.name || "Unknown",
      school_type: classData?.school_type || "Unknown",
      grade: classData?.grade || 0,
      is_active: santri.is_active,
    };
  }

  /**
   * Check if santri already checked in for shift today
   */
  static hasCheckedInToday(rfidId: string, shift: Shift): boolean {
    const attendanceToday = cacheService.get<CachedAttendanceToday>(
      this.CACHE_KEY_ATTENDANCE_TODAY,
    );

    if (!attendanceToday) {
      return false;
    }

    const checkedInMap =
      shift === "siang" ? attendanceToday.siang : attendanceToday.malam;
    return checkedInMap.has(rfidId);
  }

  /**
   * Process batch attendance
   */
  static async processBatch(
    request: BatchAttendanceRequest,
  ): Promise<BatchAttendanceResponse> {
    const response: BatchAttendanceResponse = {
      success: [],
      errors: [],
    };

    const today = getCurrentDateString();
    const attendanceToday = cacheService.get<CachedAttendanceToday>(
      this.CACHE_KEY_ATTENDANCE_TODAY,
    ) || { date: today, siang: new Map(), malam: new Map() };

    // Track processed RFID IDs for duplicate detection within batch
    const processedInBatch = new Set<string>();

    for (const item of request.batch) {
      const { rfid_id, shift: overrideShift, timestamp } = item;

      // Validate RFID ID
      const validation = validateRFIDId(rfid_id);
      if (validation) {
        response.errors.push({
          rfid_id,
          error: validation.message,
          error_code: validation.code,
        });
        continue;
      }

      // Check for duplicate in current batch
      if (processedInBatch.has(rfid_id)) {
        response.errors.push({
          rfid_id,
          error: ERROR_MESSAGES[ERROR_CODES.DUPLICATE_IN_BATCH],
          error_code: ERROR_CODES.DUPLICATE_IN_BATCH,
        });
        continue;
      }

      try {
        // Get santri data
        const cachedSantri = await this.getSantriByRFID(rfid_id);
        if (!cachedSantri) {
          response.errors.push({
            rfid_id,
            error: ERROR_MESSAGES[ERROR_CODES.RFID_NOT_FOUND],
            error_code: ERROR_CODES.RFID_NOT_FOUND,
          });
          continue;
        }

        // Check if santri is active
        if (!cachedSantri.is_active) {
          response.errors.push({
            rfid_id,
            error: ERROR_MESSAGES[ERROR_CODES.INACTIVE_SANTRI],
            error_code: ERROR_CODES.INACTIVE_SANTRI,
          });
          continue;
        }

        // Determine shift (auto-detect or override)
        let shift: Shift | null = overrideShift || detectShift();
        if (!shift) {
          response.errors.push({
            rfid_id,
            error: ERROR_MESSAGES[ERROR_CODES.OUTSIDE_HOURS],
            error_code: ERROR_CODES.OUTSIDE_HOURS,
          });
          continue;
        }

        // Check if shift is active (time-wise) - unless overridden
        if (!overrideShift && !isShiftActive(shift)) {
          response.errors.push({
            rfid_id,
            shift,
            error: ERROR_MESSAGES[ERROR_CODES.OUTSIDE_HOURS],
            error_code: ERROR_CODES.OUTSIDE_HOURS,
          });
          continue;
        }

        // Check for duplicate in today's attendance (from cache)
        if (this.hasCheckedInToday(rfid_id, shift)) {
          const checkedInMap =
            shift === "siang" ? attendanceToday.siang : attendanceToday.malam;
          const checkedTimestamp = checkedInMap.get(rfid_id) || timestamp;
          const checkedTime = formatTime(new Date(checkedTimestamp));

          const errorCode =
            shift === "siang"
              ? ERROR_CODES.ALREADY_CHECKED_SIANG
              : ERROR_CODES.ALREADY_CHECKED_MALAM;

          response.errors.push({
            rfid_id,
            shift,
            error: ERROR_MESSAGES[errorCode],
            error_code: errorCode,
            already_checked_at: checkedTime,
          });
          continue;
        }

        // Record attendance to database
        await DatabaseService.recordAttendance(
          cachedSantri.santri_id,
          cachedSantri.class_id,
          today,
          shift,
        );

        processedInBatch.add(rfid_id);

        // Update cache
        const shiftMap =
          shift === "siang" ? attendanceToday.siang : attendanceToday.malam;
        shiftMap.set(rfid_id, timestamp);

        // Prepare success response
        const checkedTime = formatTime(new Date(timestamp));
        response.success.push({
          rfid_id,
          santri_id: cachedSantri.santri_id,
          name: cachedSantri.name,
          class_name: cachedSantri.class_name,
          school_type: cachedSantri.school_type,
          shift,
          status: "present",
          already_checked: false,
          checked_in_at: checkedTime,
        });

        logger.info("Attendance recorded", {
          rfid_id,
          name: cachedSantri.name,
          class: cachedSantri.class_name,
          shift,
          time: checkedTime,
        });
      } catch (error) {
        logger.error("Failed to process attendance", { rfid_id, error });
        response.errors.push({
          rfid_id,
          error: ERROR_MESSAGES[ERROR_CODES.DATABASE_ERROR],
          error_code: ERROR_CODES.DATABASE_ERROR,
        });
      }
    }

    // Save updated attendance cache
    if (processedInBatch.size > 0) {
      cacheService.set(
        this.CACHE_KEY_ATTENDANCE_TODAY,
        attendanceToday,
        env.CACHE_TTL_ATTENDANCE,
      );
    }

    logger.info("Batch processing complete", {
      success_count: response.success.length,
      error_count: response.errors.length,
    });

    // Opsi 3: Invalidate cache after successful attendance records
    // Force fresh data from DB on next request to prevent stale data
    if (response.success.length > 0) {
      cacheService.delete(this.CACHE_KEY_ATTENDANCE_TODAY);
      logger.info("Attendance cache invalidated after successful submission");
    }

    return response;
  }

  /**
   * Get attendance summary for today
   */
  static async getTodaySummary(): Promise<{
    date: string;
    siang_count: number;
    malam_count: number;
    total_count: number;
  }> {
    const today = getCurrentDateString();
    const attendanceToday = cacheService.get<CachedAttendanceToday>(
      this.CACHE_KEY_ATTENDANCE_TODAY,
    );

    if (!attendanceToday) {
      return {
        date: today,
        siang_count: 0,
        malam_count: 0,
        total_count: 0,
      };
    }

    return {
      date: today,
      siang_count: attendanceToday.siang.size,
      malam_count: attendanceToday.malam.size,
      total_count: attendanceToday.siang.size + attendanceToday.malam.size,
    };
  }
}
