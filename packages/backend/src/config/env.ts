import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "../../../../");

// Load .env from root directory
dotenv.config({ path: resolve(rootDir, ".env") });

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

  // JWT
  JWT_SECRET: getEnv("JWT_SECRET"),
  ACCESS_TOKEN_EXPIRES_IN: parseInt(getEnv("ACCESS_TOKEN_EXPIRES_IN", "43200")),
  REFRESH_TOKEN_EXPIRES_IN: parseInt(
    getEnv("REFRESH_TOKEN_EXPIRES_IN", "604800"),
  ),

  // CORS
  FRONTEND_URL: getEnv("FRONTEND_URL", "http://localhost:3000"),

  // Timezone
  TIMEZONE: getEnv("TIMEZONE", "Asia/Jakarta"),

  // Cache
  CACHE_ENABLED: getEnv("CACHE_ENABLED", "true") === "true",
  CACHE_TTL_SANTRI: parseInt(getEnv("CACHE_TTL_SANTRI", "43200")),
  CACHE_TTL_ATTENDANCE: parseInt(getEnv("CACHE_TTL_ATTENDANCE", "300")),

  // Attendance
  SHIFT_SIANG_START: getEnv("SHIFT_SIANG_START", "13:00"),
  SHIFT_SIANG_END: getEnv("SHIFT_SIANG_END", "16:00"),
  SHIFT_MALAM_START: getEnv("SHIFT_MALAM_START", "18:00"),
  SHIFT_MALAM_END: getEnv("SHIFT_MALAM_END", "21:00"),

  // Email (SMTP)
  SMTP_HOST: getEnv("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: parseInt(getEnv("SMTP_PORT", "587")),
  SMTP_USER: getEnv("SMTP_USER"),
  SMTP_PASSWORD: getEnv("SMTP_PASSWORD"),
  SMTP_FROM_EMAIL: getEnv("SMTP_FROM_EMAIL", "noreply@absensi-system.com"),
  ALERT_EMAIL: getEnv("ALERT_EMAIL"),

  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: getEnv("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: getEnv("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: getEnv("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: getEnv("R2_BUCKET_NAME", "absensi-app"),
  R2_REGION: getEnv("R2_REGION", "auto"),

  // Cloudflare Tunnel (Optional - VPS with NAT only)
  TUNNEL_ID: getEnv("TUNNEL_ID", ""),
  TUNNEL_TOKEN: getEnv("TUNNEL_TOKEN", ""),

  // API Key (for third-party app authentication)
  API_KEY_ENABLED: getEnv("API_KEY_ENABLED", "true") === "true",
  API_KEY: getEnv("API_KEY", ""),
} as const;

export default env;
