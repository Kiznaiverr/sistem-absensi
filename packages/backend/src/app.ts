import express, { Express, Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import env from "./config/env.js";
import { createLogger, initializeErrorLogging } from "./utils/logger.js";
import { AttendanceService } from "./services/attendance.service.js";
import { enforceHttps } from "./middleware/https.middleware.js";
import { httpLoggingMiddleware } from "./middleware/http-logging.middleware.js";
import attendanceRoutes from "./routes/attendance.js";
import errorRoutes from "./routes/errors.js";
import esp32ErrorRoutes from "./routes/esp32-errors.js";
import classesRoutes from "./routes/classes.js";
import adminRoutes from "./routes/admin.js";
import santriRoutes from "./routes/santri.js";
import authRoutes from "./routes/auth.js";
import { validateToken } from "./middleware/auth.middleware.js";
import { auditLoggingMiddleware } from "./middleware/audit-logging.middleware.js";

const logger = createLogger("App");

const app: Express = express();

/**
 * Get __dirname equivalent in ES modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Security middleware - Apply helmet for security headers
 * Includes: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, X-XSS-Protection
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
  }),
);

/**
 * HTTPS enforcement middleware
 * Redirects HTTP to HTTPS in production
 * Allows HTTP in development for local testing
 */
app.use(enforceHttps);

/**
 * CORS middleware - White list frontend URL(s)
 * Supports single or multiple URLs via environment variable
 */
const allowedOrigins = env.FRONTEND_URL.split(",").map((url) => url.trim());

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    maxAge: 3600,
  }),
);

/**
 * Cookie parsing middleware
 * Parses HttpOnly cookies from incoming requests
 * Required for reading auth tokens from cookies
 */
app.use(cookieParser());

/**
 * Request body parsing middleware with size limits
 * JSON: 5MB, URL-encoded: 5MB
 */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

/**
 * Compression middleware for response gzip
 */
app.use(compression());

/**
 * Rate limiting for login endpoint
 * 10 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  keyGenerator: (req) => ipKeyGenerator(req.ip || ""), // Use client IP for rate limiting with IPv6 support
});

/**
 * Rate limiting for API endpoints
 * 20 requests per second per IP (1200 per minute)
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 1000, // 1 second window
  max: 20, // 20 requests per second
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ""),
});

/**
 * Request timeout middleware
 * Set 5 minute timeout for all requests (for large file imports)
 */
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(5 * 60 * 1000, () => {
    res.status(408).json({
      success: false,
      error: "Request timeout",
      error_code: "REQUEST_TIMEOUT",
    });
  });
  next();
});

/**
 * HTTP request/response logging middleware
 * Logs simplified format: [TIME] [HTTP] [METHOD /path] STATUS (duration)
 * Full details only on error responses
 */
app.use(httpLoggingMiddleware);

/**
 * Audit logging middleware
 * Logs security-relevant events (unauthorized access, rate limits, state changes)
 */
app.use(auditLoggingMiddleware);

/**
 * Health check endpoint - minimal data, no auth required
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/**
 * Auth Routes - Public access with login rate limiting
 * Only POST /api/auth/login is rate limited
 * This middleware will check the path and method
 */
app.use("/api/auth", (req: Request, res: Response, next: NextFunction) => {
  // Apply rate limiter only to POST /api/auth/login
  if (req.method === "POST" && req.path === "/login") {
    return loginLimiter(req, res, next);
  }
  next();
});
app.use("/api/auth", authRoutes);

/**
 * Protected API Routes
 * All routes require valid JWT token and rate limiting (20 req/sec per IP)
 */
app.use("/api/attendance", validateToken, apiLimiter, attendanceRoutes);
app.use("/api/attendance/errors", validateToken, apiLimiter, errorRoutes);
app.use("/api/attendance/errors", validateToken, apiLimiter, errorRoutes);
app.use("/api/error/esp32", validateToken, apiLimiter, esp32ErrorRoutes);
app.use("/api/classes", validateToken, apiLimiter, classesRoutes);
app.use("/api/santri", validateToken, apiLimiter, santriRoutes);
app.use("/api/admin", validateToken, apiLimiter, adminRoutes);

/**
 * Static file serving from Vite build output
 * Serves compiled frontend in production
 */
const publicDir = join(__dirname, "../public");
app.use(express.static(publicDir));

/**
 * SPA fallback route
 * Serves index.html for unmatched routes (client-side routing)
 */
app.get("*", (_req: Request, res: Response) => {
  const indexPath = join(publicDir, "index.html");
  res.sendFile(indexPath, (err: any) => {
    if (err) {
      logger.error("Error sending index.html", err);
      res.status(500).json({
        success: false,
        error: "Error loading application",
        error_code: "APP_LOAD_ERROR",
      });
    }
  });
});

/**
 * Global error handling middleware
 * Catches and formats all errors
 * Filters sensitive information in production
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";
  let error_message = err.message || "Internal Server Error";

  /**
   * Filter error messages in production
   * Prevent leaking sensitive system information
   */
  if (env.NODE_ENV === "production") {
    if (status === 500) {
      error_message = "Internal Server Error";
    }
    logger.error("Request error", {
      status,
      error: err.message,
      stack: err.stack,
    });
  } else {
    logger.error("Request error", {
      status,
      error: err.message,
      stack: err.stack,
    });
  }

  res.status(status).json({
    success: false,
    error: error_message,
    error_code: errorCode,
    ...(env.NODE_ENV === "development" && { details: err.stack }),
  });
});

export default app;
