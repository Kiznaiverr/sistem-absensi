# Sistem Absensi Santri - RFID Based Attendance Management

Sistem manajemen absensi santri untuk Madrasah (SMP & SMK) yang menggunakan RFID reader sebagai input. Sistem ini memproses absensi siang (13:00-16:00) dan malam (18:00-21:00) dengan caching lokal untuk performa optimal.

## Fitur Utama

- **RFID Integration**: Integrasi dengan RFID reader USB/Serial untuk scanning otomatis
- **Two Shift Management**: Shift siang (13:00-16:00) dan shift malam (18:00-21:00)
- **Smart Caching**: In-memory cache untuk data santri dan attendance dengan TTL configurable
- **Batch Processing**: Submit absensi dalam batch (efficient untuk multiple scans)
- **Shift Auto-Detection**: Auto-detect shift berdasarkan waktu saat ini dengan opsi override manual
- **Duplicate Prevention**: Prevent double check-in per santri per shift per hari
- **Monthly Data Management**: Auto-sync ketika berganti bulan
- **Excel Export**: Export data attendance ke format Excel dengan formatting
- **JSON Export**: Export data attendance dalam format JSON matrix
- **Timezone Aware**: Semua operasi time-aware menggunakan timezone Asia/Jakarta (UTC+7)
- **JWT Authentication**: Secure token-based authentication dengan refresh mechanism
- **Rate Limiting**: Protection untuk API endpoints dan login attempts
- **Audit Logging**: Complete audit trail untuk security events
- **Admin Dashboard**: Monitor system stats, view archives, manage users

## Tech Stack

### Backend

- **Runtime**: Node.js 22 (Alpine Docker image)
- **Framework**: Express.js 4.22.1
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Cache**: In-memory with TTL
- **Authentication**: JWT (HS256)
- **Time Handling**: date-fns + date-fns-tz
- **Rate Limiting**: express-rate-limit
- **Additional**: helmet, cors, compression, cookie-parser, express-validator

### Frontend

- **Bundler**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Local Storage**: IndexedDB
- **Architecture**: Vanilla TypeScript (no framework)

### Infrastructure

- **Deployment**: Docker + Docker Compose
- **Port**: 5000 (default)
- **Environment**: Node.js 22 Alpine

## Requirements

- Node.js 18.0.0 or higher
- pnpm 8.0.0 or higher (for package management)
- Supabase account with PostgreSQL database
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Docker 20.10+ and Docker Compose 2.0+ (for containerized deployment)

## Installation Guide

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/absensi-backend.git
cd absensi-backend
```

### 2. Install Dependencies

Using pnpm (recommended for monorepo):

```bash
pnpm install
```

Or using npm:

```bash
npm install
```

### 3. Environment Setup

Create `.env` file in `packages/backend/` directory:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `.env` with your credentials:

```env
# Environment
NODE_ENV=development

# Server
SERVER_PORT=5000
SERVER_HOST=0.0.0.0

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxx

# JWT Authentication
JWT_SECRET=your-secret-key-min-32-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ACCESS_TOKEN_EXPIRES_IN=43200
REFRESH_TOKEN_EXPIRES_IN=604800

# CORS
FRONTEND_URL=http://localhost:3000,http://localhost:5000

# Timezone
TIMEZONE=Asia/Jakarta

# Cache
CACHE_ENABLED=true
CACHE_TTL_SANTRI=7200
CACHE_TTL_ATTENDANCE=300

# Attendance
SHIFT_SIANG_START=13:00
SHIFT_SIANG_END=16:00
SHIFT_MALAM_START=18:00
SHIFT_MALAM_END=21:00
```

### 4. Database Setup

Connect to your Supabase project and run the SQL schema:

```bash
# Option 1: Using Supabase SQL Editor
# Copy schema from schema.sql to Supabase SQL Editor and run

# Option 2: Using psql CLI
psql -h your-host.supabase.co -U postgres -d postgres < schema.sql
```

Or manually create tables:

1. Go to Supabase SQL Editor
2. Copy content from `schema.sql`
3. Execute the SQL

### 5. Build Project

Build both frontend and backend:

```bash
pnpm build
```

Or build individually:

```bash
# Build frontend only
pnpm -F @absensi/frontend run build

# Build backend only
pnpm -F @absensi/backend run build
```

### 6. Start Development Server

```bash
pnpm start
```

Access the application at http://localhost:5000

## Development

### Local Development

Run in development mode:

```bash
pnpm start
```

This will:
- Start Express backend on port 5000
- Serve frontend from backend public folder
- Enable hot reload for both frontend and backend

### Watch Mode

For development with auto-rebuild:

```bash
pnpm dev
```

### Build for Production

```bash
pnpm build
```

This will:
- Build frontend with Vite
- Copy frontend artifacts to backend public folder
- Compile TypeScript backend

### Run Production Build

```bash
NODE_ENV=production pnpm start
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t absensi-app:latest .
```

### Run with Docker Compose

```bash
docker-compose up -d
```

This will:
- Build the Docker image automatically
- Start the container with correct environment variables
- Expose port 5000
- Auto-restart on container failure

### Docker Compose Configuration

The `docker-compose.yml` sets:

```yaml
environment:
  - NODE_ENV=production
  - SERVER_PORT=5000
  - FRONTEND_URL=http://localhost:5000
  - # ... (other env vars from .env)
```

### Run Specific Version

```bash
docker-compose up -d absensi-app
```

### View Logs

```bash
docker-compose logs -f absensi-app
```

### Stop Container

```bash
docker-compose down
```

For detailed Docker instructions, see [DOCKER.md](DOCKER.md)

## Rate Limiting

The API implements the following rate limits to protect endpoints:

### Login Rate Limiting

- **Limit**: 10 attempts per 15 minutes per IP
- **Window**: 15 minutes (900,000 ms)
- **Status Code**: HTTP 429

### API Rate Limiting

- **Limit**: 20 requests per second per IP
- **Window**: 1 second
- **Status Code**: HTTP 429

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "success": false,
  "error": "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

The response includes standard rate limit headers:

```
Retry-After: 900
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1681234567
```

### Frontend Rate Limited State

When frontend detects rate limiting (429 status), it shows:

- "Rate Limited" message
- 15-minute countdown timer
- Auto-redirect to login after countdown completes
- Disable retry attempts during cooldown

## API Documentation

For complete API endpoint documentation, request/response examples, and error codes, see [API_DOCS.md](API_DOCS.md)

### Key Endpoints

Authentication:
- `POST /api/auth/login` - Login with username/email and password
- `POST /api/auth/refresh` - Refresh access token using refresh token
- `POST /api/auth/logout` - Logout and invalidate session

Attendance:
- `POST /api/attendance/batch` - Submit RFID batch scans
- `GET /api/attendance/today` - Get today's attendance summary
- `GET /api/attendance/month` - Get monthly attendance with filters
- `GET /api/attendance/available-months` - Get list of months with data
- `GET /api/attendance/export` - Export attendance as JSON matrix

Classes & Santri:
- `GET /api/classes` - Get all classes
- `GET /api/classes/:classId/santri` - Get santri by class
- `POST /api/classes/init-cache` - Reinitialize cache (debug)

Admin:
- `GET /health` - Server health check
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/archive/status` - Archive status
- `GET /api/admin/archive/history` - Archive history

## Project Structure

```
absensi-backend/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts              # Express app configuration
│   │   │   ├── server.ts           # Server entry point
│   │   │   ├── config/
│   │   │   │   ├── env.ts          # Environment variables loader
│   │   │   │   ├── constants.ts    # App-wide constants
│   │   │   │   ├── database.ts     # Supabase client
│   │   │   │   ├── index.ts        # Config exports
│   │   │   │   └── time.ts         # Shift configuration
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts         # Authentication endpoints
│   │   │   │   ├── attendance.ts   # Attendance endpoints
│   │   │   │   ├── classes.ts      # Classes endpoints
│   │   │   │   └── admin.ts        # Admin endpoints
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── attendance.service.ts
│   │   │   │   ├── cache.service.ts
│   │   │   │   ├── database.service.ts
│   │   │   │   ├── archive.service.ts
│   │   │   │   ├── export.service.ts
│   │   │   │   └── excel/
│   │   │   │       ├── ExcelGenerator.ts
│   │   │   │       ├── ExcelFormatters.ts
│   │   │   │       ├── ExcelPreview.ts
│   │   │   │       ├── ExcelStyles.ts
│   │   │   │       └── index.ts
│   │   │   ├── middleware/
│   │   │   │   ├── audit-logging.middleware.ts
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── https.middleware.ts
│   │   │   │   └── validation.middleware.ts
│   │   │   ├── jobs/
│   │   │   │   └── archive.job.ts  # Daily archive job
│   │   │   └── utils/
│   │   │       ├── audit.ts        # Audit logging
│   │   │       ├── logger.ts       # Logging utility
│   │   │       ├── time.ts         # Time utilities
│   │   │       └── validators.ts   # Validation helpers
│   │   ├── public/                 # Static frontend files
│   │   ├── logs/                   # Application logs
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.ts             # Entry point
│   │   │   ├── index.html
│   │   │   ├── components/
│   │   │   │   ├── rfid-form.ts
│   │   │   │   ├── attendance/
│   │   │   │   ├── auth/
│   │   │   │   │   └── LoginPage.ts
│   │   │   │   ├── export/
│   │   │   │   ├── common/
│   │   │   │   ├── layout/
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── api.ts          # API client
│   │   │   │   ├── auth.ts         # Auth service
│   │   │   │   ├── cache.ts        # Cache service
│   │   │   │   ├── timezone.ts
│   │   │   │   └── excel/
│   │   │   └── styles/
│   │   │       └── index.css
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── postcss.config.js
│   └── shared/
│       ├── types.ts                # Shared TypeScript types
│       ├── index.ts
│       └── package.json
├── schema.sql                      # Database schema
├── docker-compose.yml              # Docker Compose configuration
├── Dockerfile                      # Docker image definition
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── API_DOCS.md                     # API documentation
├── DOCKER.md                       # Docker documentation
├── README.md                       # This file
├── TODO.md                         # Development roadmap
└── .env.example                    # Environment template
```

## Configuration

### Environment Variables

Key configuration options:

- **NODE_ENV**: Set to `development` or `production`
- **SERVER_PORT**: Port to listen on (default: 5000)
- **JWT_SECRET**: Secret key for token signing (min 32 characters)
- **TIMEZONE**: Timezone for all date operations (default: Asia/Jakarta)
- **CACHE_ENABLED**: Enable in-memory caching (default: true)
- **FRONTEND_URL**: CORS-allowed origins (comma-separated)

### Shift Configuration

Configure work shifts in `.env`:

```env
SHIFT_SIANG_START=13:00
SHIFT_SIANG_END=16:00
SHIFT_MALAM_START=18:00
SHIFT_MALAM_END=21:00
```

### Cache Configuration

Control cache behavior:

```env
CACHE_ENABLED=true
CACHE_TTL_SANTRI=7200    # 2 hours for santri cache
CACHE_TTL_ATTENDANCE=300 # 5 minutes for attendance cache
```

### Token Configuration

Configure JWT tokens:

```env
ACCESS_TOKEN_EXPIRES_IN=43200   # 12 hours in seconds
REFRESH_TOKEN_EXPIRES_IN=604800 # 7 days in seconds
JWT_SECRET=your-secret-key-min-32-chars-xxxxxxxx
```

## Database Schema

### Tables

**classes**
- Stores information about classes (SMP-1, SMK-2, etc)
- Fields: id, name, school_type, grade, created_at

**santri**
- Stores student information with RFID mapping
- Fields: id, rfid_id (unique), name, class_id, is_active, created_at

**attendance_logs**
- Stores daily attendance records
- Fields: id, santri_id, class_id, date, shift, checked_in_at, status, notes, created_at
- Unique constraint: (santri_id, date, shift) to prevent duplicates

**admin_users**
- Stores admin credentials
- Fields: id, email, username, password_hash, is_active, created_at, updated_at

**archive_logs**
- Stores archive operation history
- Fields: id, archive_date, records_count, status, message, created_at

## Authentication

### Token System

The system uses JWT with two tokens:

**Access Token**
- Valid for 12 hours
- Used for API requests
- Sent in Authorization header: `Bearer <token>`

**Refresh Token**
- Valid for 7 days
- Used to get new access tokens
- Stored securely on frontend

### Auto-Refresh

Frontend automatically refreshes tokens:
- 5 minutes before access token expires
- When receiving 401 Unauthorized response
- Prevents interruption during user session

### Token Lifecycle

1. User logs in with username/email and password
2. Server returns access_token and refresh_token
3. Frontend stores tokens in localStorage
4. All API requests include access token in header
5. When token expires, frontend uses refresh token to get new one
6. If refresh also expires, user must login again

## Caching Strategy

### Backend In-Memory Cache

- **Classes**: 2 hours TTL (configurable)
- **Santri per class**: 2 hours TTL
- **Attendance summary**: 5 minutes TTL
- Auto-cleanup every 5 minutes
- Configurable via environment variables

### Frontend IndexedDB Cache

- **Santri master data**: Persistent
- **Attendance data**: Cleared at midnight
- Survives page refresh
- Minimal overhead

### Cache Invalidation

Cache is automatically invalidated when:
- Data is updated via API
- TTL expires
- Admin manually reinitializes via `/api/classes/init-cache`

## Shift Management

### Work Hours

- **Siang**: 13:00 - 16:00 (1 PM - 4 PM)
- **Malam**: 18:00 - 21:00 (6 PM - 9 PM)

### Shift Detection

- If student scans outside work hours without specifying shift: ERROR
- If student scans during work hours without specifying shift: Auto-detect
- If student specifies shift: Use specified shift

### Manual Override

Frontend allows manual shift selection even outside work hours (for catch-up attendance)

## Attendance Features

### Duplicate Prevention

Prevents the same student from checking in twice:
- One check-in per shift per day
- Unique constraint in database
- Validation on batch processing

### Batch Processing

- Collects RFID scans at regular intervals
- Submits batch to API
- Efficient for high-volume scanning
- Handles partial success (some scans succeed, others fail)

### Export Features

Export attendance in multiple formats:

**JSON Matrix Export**
- Attendance matrix (names vs dates)
- Percentage calculations
- Filter by class, shift, date range

**Excel Export**
- Professional formatting
- Metadata sheet
- Print-friendly layout

## Troubleshooting

### CORS Error: "Not allowed by CORS"

**Problem**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**: Check FRONTEND_URL in .env matches your current origin

```env
# For local development
FRONTEND_URL=http://localhost:5000,http://localhost:3000

# For production
FRONTEND_URL=https://yourdomain.com
```

### Rate Limit Error: "Too many login attempts"

**Problem**: Cannot login, getting 429 error

**Solution**: Wait 15 minutes for rate limit window to reset

For testing, adjust in `.env`:

```env
LOGIN_LIMIT_WINDOW_MS=60000      # 1 minute
LOGIN_LIMIT_MAX_ATTEMPTS=50      # 50 attempts
```

### Cache Not Updating

**Problem**: Old data showing after updates

**Solution**: Manually reinitialize cache

```bash
curl -X POST http://localhost:5000/api/classes/init-cache \
  -H "Authorization: Bearer <token>"
```

Or restart the server:

```bash
docker-compose restart
# or
pnpm start
```

### Database Connection Failed

**Problem**: `Error: connect ECONNREFUSED` or similar

**Solutions**:
1. Check SUPABASE_URL and SUPABASE_SECRET_KEY are correct
2. Verify database is running: `SELECT 1` in Supabase console
3. Check network connectivity to Supabase
4. Verify VPN/firewall allows connections to Supabase
5. Check database credentials in .env file

### Token Expired: "Invalid or expired token"

**Problem**: Getting 401 errors after some time

**Solution**: App should auto-refresh token. If persists:
1. Clear browser localStorage
2. Login again
3. Check server logs for token validation errors

### Attendance Data Not Saving

**Problem**: RFID scans processed but not appearing in history

**Solutions**:
1. Check attendance_logs table exists in database
2. Verify santri RFID IDs are registered
3. Check server logs for database errors
4. Verify shift configuration matches system clock

### Port Already in Use

**Problem**: `EADDRINUSE: address already in use :::5000`

**Solutions**:

Option 1: Use different port

```env
SERVER_PORT=5001
```

Option 2: Kill existing process

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### High Memory Usage

**Problem**: Server memory grows over time

**Solutions**:
1. Reduce cache TTL in .env
2. Enable cache cleanup more frequently
3. Restart container periodically
4. Monitor with `docker stats`

## Performance Tips

### For Optimal Performance

1. **Increase Cache TTL**: If data changes infrequently
   ```env
   CACHE_TTL_SANTRI=14400   # 4 hours instead of 2
   ```

2. **Use Connection Pool**: For high-traffic scenarios
   - Already configured in Supabase client

3. **Monitor Rate Limits**: Adjust if needed
   ```env
   RATE_LIMIT_MAX_REQUESTS=50  # Increase for high traffic
   ```

4. **Use Redis for Cache**: In production with multiple servers
   - Currently uses in-memory cache
   - Can upgrade to Redis if needed

5. **Enable Compression**: Already enabled by default
   - Reduce bandwidth usage

## Security Best Practices

1. **Keep JWT_SECRET Secure**
   - Use strong, random secret
   - Min 32 characters
   - Never commit to repository

2. **Update Dependencies**
   - Regular `pnpm update`
   - Monitor security advisories

3. **Use HTTPS in Production**
   - Configure reverse proxy (nginx/Apache)
   - Enable HSTS headers

4. **Rate Limiting**
   - Protects against brute force attacks
   - DoS protection

5. **Input Validation**
   - All inputs validated
   - SQL injection protection via Supabase

6. **Environment Variables**
   - Never commit .env file
   - Use .env.example as template
   - Rotate credentials regularly

## Development

### Add New Endpoint

1. Create route file in `packages/backend/src/routes/`
2. Implement request/response logic
3. Add to `app.ts` routing
4. Update API_DOCS.md

### Modify Database Schema

1. Create migration script
2. Run in Supabase SQL Editor
3. Update TypeScript types
4. Test thoroughly before production

### Update Frontend Components

1. Create component in `packages/frontend/src/components/`
2. Import in main entry
3. Add styling via Tailwind
4. Test in all browsers

### Build and Test

```bash
# Build everything
pnpm build

# Build specific package
pnpm -F @absensi/backend run build

# Run tests (if configured)
pnpm test
```

## Monitoring

### Logs

Check server logs for issues:

```bash
# Docker
docker-compose logs -f absensi-app

# Local
pnpm start | grep -E "error|Error|ERROR"
```

### Health Check

Verify server status:

```bash
curl http://localhost:5000/health
```

### System Stats

View system information:

```bash
curl http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer <token>"
```

## Support & Contributing

### Report Issues

1. Check existing issues on GitHub
2. Provide reproduction steps
3. Include error logs
4. Specify Node.js and OS version

### Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Submit pull request
5. Follow coding standards

## License

[Add your license here]

## Version History

**Current Version**: 1.0.0
**Status**: Stable
**Last Updated**: April 16, 2026

### Version 1.0.0

- Full RFID attendance management
- Two-shift system
- Batch processing
- JWT authentication
- Rate limiting
- Export functionality
- Admin dashboard
- Archive management
- Audit logging

---

Sistem Absensi Santri - RFID Based Attendance Management
Last Updated: April 16, 2026
