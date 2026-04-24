/**
 * Cache Service - Browser-side caching using IndexedDB
 * Stores: santri list, todayAttendance
 */

export interface CachedSantri {
  rfid_id: string;
  santri_id: string;
  name: string;
  class_id: string;
  class_name: string;
  school_type: string;
  grade: number;
  is_active: boolean;
}

export interface AttendanceCheckIn {
  rfid_id: string;
  santri_id: string;
  name: string;
  class_name: string;
  school_type: string;
  shift: "siang" | "malam";
  checked_in_at: number; // timestamp
  status: "success" | "duplicate" | "error";
  message?: string;
}

interface CacheStore {
  santri: Map<string, CachedSantri>;
  attendance_today: {
    date: string;
    siang: Set<string>; // RFID IDs
    malam: Set<string>; // RFID IDs
    records: AttendanceCheckIn[];
  };
  available_months: {
    siang: { years: number[]; months_by_year: Record<number, number[]> };
    malam: { years: number[]; months_by_year: Record<number, number[]> };
  };
  last_sync: {
    santri: number;
    attendance: number;
    available_months: number;
  };
}

export class FrontendCacheService {
  private static readonly DB_NAME = "absensi_db";
  private static readonly STORE_NAME = "cache";
  private static readonly TTL_ATTENDANCE_SECONDS = 300; // 5 minutes, matches backend TTL
  private static readonly TTL_AVAILABLE_MONTHS_SECONDS = 1800; // 30 minutes - available-months doesn't change frequently
  private static db: IDBDatabase | null = null;

  private static store: CacheStore = {
    santri: new Map(),
    attendance_today: {
      date: new Date().toISOString().split("T")[0],
      siang: new Set(),
      malam: new Set(),
      records: [],
    },
    available_months: {
      siang: { years: [], months_by_year: {} },
      malam: { years: [], months_by_year: {} },
    },
    last_sync: {
      santri: 0,
      attendance: 0,
      available_months: 0,
    },
  };

  /**
   * Check if attendance cache is expired (older than TTL)
   */
  private static isAttendanceCacheExpired(): boolean {
    const lastSync = this.store.last_sync.attendance;
    if (lastSync === 0) return true; // Never synced

    const ageMs = Date.now() - lastSync;
    const ageSeconds = Math.floor(ageMs / 1000);

    return ageSeconds > this.TTL_ATTENDANCE_SECONDS;
  }

  /**
   * Check if available-months cache is expired (older than TTL)
   */
  private static isAvailableMonthsCacheExpired(): boolean {
    const lastSync = this.store.last_sync.available_months;
    if (lastSync === 0) return true; // Never synced

    const ageMs = Date.now() - lastSync;
    const ageSeconds = Math.floor(ageMs / 1000);

    return ageSeconds > this.TTL_AVAILABLE_MONTHS_SECONDS;
  }

  /**
   * Clear attendance cache when expired
   */
  private static clearExpiredAttendanceCache(): void {
    if (this.isAttendanceCacheExpired()) {
      this.store.attendance_today = {
        date: new Date().toISOString().split("T")[0],
        siang: new Set(),
        malam: new Set(),
        records: [],
      };
      this.saveToIndexedDB();
    }
  }

  /**
   * Initialize IndexedDB
   */
  static async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadFromIndexedDB().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: "key" });
        }
      };
    });
  }

  /**
   * Load cache from IndexedDB
   */
  private static async loadFromIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result;
        for (const item of items) {
          if (item.key === "santri") {
            this.store.santri = new Map(item.value);
          }
          if (item.key === "attendance_today") {
            this.store.attendance_today = {
              ...item.value,
              siang: new Set(item.value.siang),
              malam: new Set(item.value.malam),
            };
          }
          if (item.key === "available_months") {
            this.store.available_months = item.value;
          }
        }
        resolve();
      };
    });
  }

  /**
   * Save to IndexedDB
   */
  private static async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      // Save santri
      store.put({
        key: "santri",
        value: Array.from(this.store.santri.entries()),
      });

      // Save attendance
      store.put({
        key: "attendance_today",
        value: {
          ...this.store.attendance_today,
          siang: Array.from(this.store.attendance_today.siang),
          malam: Array.from(this.store.attendance_today.malam),
        },
      });

      // Save available-months
      store.put({
        key: "available_months",
        value: this.store.available_months,
      });

      transaction.oncomplete = () => resolve();
    });
  }

  /**
   * Get all cached santri
   */
  static getSantri(): CachedSantri[] {
    return Array.from(this.store.santri.values());
  }

  /**
   * Get santri by RFID ID
   */
  static getSantriByRFID(rfidId: string): CachedSantri | null {
    return this.store.santri.get(rfidId) || null;
  }

  /**
   * Set santri cache
   */
  static setSantri(santri: CachedSantri[]): void {
    this.store.santri.clear();
    for (const s of santri) {
      this.store.santri.set(s.rfid_id, s);
    }
    this.store.last_sync.santri = Date.now();
    this.saveToIndexedDB();
  }

  /**
   * Check if RFID already checked in today for shift
   */
  static isAlreadyCheckedIn(rfidId: string, shift: "siang" | "malam"): boolean {
    this.clearExpiredAttendanceCache();

    const set =
      shift === "siang"
        ? this.store.attendance_today.siang
        : this.store.attendance_today.malam;
    return set.has(rfidId);
  }

  /**
   * Add attendance record
   */
  static addAttendanceRecord(record: AttendanceCheckIn): void {
    const set =
      record.shift === "siang"
        ? this.store.attendance_today.siang
        : this.store.attendance_today.malam;

    set.add(record.rfid_id);
    this.store.attendance_today.records.push(record);
    this.store.last_sync.attendance = Date.now();
    this.saveToIndexedDB();
  }

  /**
   * Get today's attendance records
   */
  static getTodayRecords(): AttendanceCheckIn[] {
    this.clearExpiredAttendanceCache();
    return this.store.attendance_today.records;
  }

  /**
   * Get today's attendance summary
   */
  static getTodaySummary(): {
    siang_count: number;
    malam_count: number;
    total_count: number;
  } {
    return {
      siang_count: this.store.attendance_today.siang.size,
      malam_count: this.store.attendance_today.malam.size,
      total_count:
        this.store.attendance_today.siang.size +
        this.store.attendance_today.malam.size,
    };
  }

  /**
   * Clear today's attendance (call at midnight)
   */
  static clearTodayAttendance(): void {
    const today = new Date().toISOString().split("T")[0];
    this.store.attendance_today = {
      date: today,
      siang: new Set(),
      malam: new Set(),
      records: [],
    };
    this.saveToIndexedDB();
  }

  /**
   * Get available-months from cache
   */
  static getAvailableMonths(shift: "siang" | "malam"): {
    years: number[];
    months_by_year: Record<number, number[]>;
  } | null {
    if (this.isAvailableMonthsCacheExpired()) {
      return null; // Cache expired
    }
    return this.store.available_months[shift];
  }

  /**
   * Set available-months cache
   */
  static setAvailableMonths(
    shift: "siang" | "malam",
    data: { years: number[]; months_by_year: Record<number, number[]> },
  ): void {
    this.store.available_months[shift] = data;
    this.store.last_sync.available_months = Date.now();
    this.saveToIndexedDB();
  }

  /**
   * Get cache stats
   */
  static getStats(): {
    santri_count: number;
    today_attendance_count: number;
    last_sync_santri: string;
    last_sync_attendance: string;
  } {
    return {
      santri_count: this.store.santri.size,
      today_attendance_count: this.store.attendance_today.records.length,
      last_sync_santri: new Date(this.store.last_sync.santri).toLocaleString(),
      last_sync_attendance: new Date(
        this.store.last_sync.attendance,
      ).toLocaleString(),
    };
  }

  /**
   * Clear all cache
   */
  static clearAll(): void {
    this.store.santri.clear();
    this.clearTodayAttendance();
    if (this.db) {
      const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
      transaction.objectStore(this.STORE_NAME).clear();
    }
  }
}
