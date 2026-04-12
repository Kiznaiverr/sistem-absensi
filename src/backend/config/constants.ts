export const CLASSES = {
  SMP: {
    SMP_1: "SMP-1",
    SMP_2: "SMP-2",
    SMP_3: "SMP-3",
  },
  SMK: {
    SMK_1: "SMK-1",
    SMK_2: "SMK-2",
    SMK_3: "SMK-3",
  },
} as const;

export const SCHOOL_TYPES = {
  SMP: "SMP",
  SMK: "SMK",
} as const;

export const SHIFTS = {
  SIANG: "siang",
  MALAM: "malam",
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

export const CLASS_GRADES = {
  GRADE_1: 1,
  GRADE_2: 2,
  GRADE_3: 3,
} as const;

export const ERROR_CODES = {
  RFID_NOT_FOUND: "RFID_NOT_FOUND",
  OUTSIDE_HOURS: "OUTSIDE_HOURS",
  ALREADY_CHECKED_SIANG: "ALREADY_CHECKED_SIANG",
  ALREADY_CHECKED_MALAM: "ALREADY_CHECKED_MALAM",
  INACTIVE_SANTRI: "INACTIVE_SANTRI",
  DUPLICATE_IN_BATCH: "DUPLICATE_IN_BATCH",
  DATABASE_ERROR: "DATABASE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export const SUCCESS_MESSAGES = {
  ATTENDANCE_RECORDED: "Absensi berhasil tercatat",
  BATCH_PROCESSED: "Batch absensi berhasil diproses",
} as const;

export const ERROR_MESSAGES = {
  [ERROR_CODES.RFID_NOT_FOUND]: "RFID tidak ditemukan di data santri",
  [ERROR_CODES.OUTSIDE_HOURS]: "Diluar jam absensi",
  [ERROR_CODES.ALREADY_CHECKED_SIANG]: "Sudah absen siang hari ini",
  [ERROR_CODES.ALREADY_CHECKED_MALAM]: "Sudah absen malam hari ini",
  [ERROR_CODES.INACTIVE_SANTRI]: "Santri tidak aktif",
  [ERROR_CODES.DUPLICATE_IN_BATCH]: "Duplikat dalam batch yang sama",
  [ERROR_CODES.DATABASE_ERROR]: "Terjadi kesalahan pada database",
  [ERROR_CODES.VALIDATION_ERROR]: "Validasi data gagal",
} as const;
