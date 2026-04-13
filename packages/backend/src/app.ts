import express, { Express, Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import env from "./config/env.js";
import { createLogger, initializeErrorLogging } from "./utils/logger.js";
import { AttendanceService } from "./services/attendance.service.js";
import attendanceRoutes from "./routes/attendance.js";
import classesRoutes from "./routes/classes.js";
import adminRoutes from "./routes/admin.js";

const logger = createLogger("App");

const app: Express = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", env.FRONTEND_URL);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/attendance", attendanceRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/admin", adminRoutes);

// Serve static files dari Vite build (in production)
const publicDir = join(__dirname, "../public");
app.use(express.static(publicDir));

// SPA fallback - serve index.html untuk semua route yang tidak match
app.get("*", (_req: Request, res: Response) => {
  const indexPath = join(publicDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error("Error sending index.html", err);
      res.status(500).send("Error loading application");
    }
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Request error", {
    method: err.method,
    path: err.path,
    error: err.message,
    status: err.status || 500,
  });

  const status = err.status || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";

  res.status(status).json({
    success: false,
    error: err.message || "Internal Server Error",
    error_code: errorCode,
    ...(env.NODE_ENV === "development" && { details: err.stack }),
  });
});

export default app;
