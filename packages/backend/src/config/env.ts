import "dotenv/config";

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue || "";
};

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || "development",
  SERVER_PORT: parseInt(getEnv("SERVER_PORT", "5000")),
  SERVER_HOST: getEnv("SERVER_HOST", "0.0.0.0"),

  // Supabase
  SUPABASE_URL: getEnv("SUPABASE_URL"),
  SUPABASE_PUBLISHABLE_KEY: getEnv("SUPABASE_PUBLISHABLE_KEY"),
  SUPABASE_SECRET_KEY: getEnv("SUPABASE_SECRET_KEY"),

  // CORS
  FRONTEND_URL: getEnv("FRONTEND_URL", "http://localhost:3000"),

  // Timezone
  TIMEZONE: getEnv("TIMEZONE", "Asia/Jakarta"),

  // Cache
  CACHE_ENABLED: getEnv("CACHE_ENABLED", "true") === "true",
  CACHE_TTL_SANTRI: parseInt(getEnv("CACHE_TTL_SANTRI", "43200")), // 12 hours
  CACHE_TTL_ATTENDANCE: parseInt(getEnv("CACHE_TTL_ATTENDANCE", "300")), // 5 minutes

  // Attendance
  SHIFT_SIANG_START: getEnv("SHIFT_SIANG_START", "13:00"),
  SHIFT_SIANG_END: getEnv("SHIFT_SIANG_END", "16:00"),
  SHIFT_MALAM_START: getEnv("SHIFT_MALAM_START", "18:00"),
  SHIFT_MALAM_END: getEnv("SHIFT_MALAM_END", "21:00"),
} as const;

export default env;
