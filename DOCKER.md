# Docker Setup Guide - Sistem Absensi Santri

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose (usually comes with Docker Desktop)

**Installation:**

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac)
- [Docker Engine](https://docs.docker.com/engine/install/) (Linux)

---

## Quick Start

### 1. Build Docker Image

```bash
# Build image (this will take a few minutes first time)
docker build -t absensi-app .

# Or using docker-compose (easier)
docker-compose build
```

### 2. Run with Docker Compose (Recommended)

```bash
# Start all services
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Access Application

```
Frontend: http://localhost:5000
Backend API: http://localhost:5000/api
Health Check: http://localhost:5000/health
```

---

---

## Environment Setup (Updated Structure)

### File Location Change

Environment variables have been **centralized at the project root** for better Docker Compose compatibility:

- **Old location:** `packages/backend/.env` (deprecated)
- **New location:** `.env` (root directory)

### First Time Setup

1. **Copy template:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**

   ```bash
   # Linux/Mac
   nano .env

   # Windows PowerShell
   code .env
   ```

3. **Required variables** (all must be filled):
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
   - `JWT_SECRET`
   - `SMTP_*` (for email notifications)
   - `CLOUDFLARE_TOKEN` and `CLOUDFLARE_TUNNEL_ID` (only if using VPS NAT)

### Why This Change?

- ✅ Docker Compose can parse `${VAR}` substitutions from root `.env`
- ✅ Single source of truth for all environment config
- ✅ Standard monorepo pattern
- ✅ Fixes variable injection issues with Cloudflare Tunnel

---

## Troubleshooting

### Variable Not Set Warning

```
WARNING: The CLOUDFLARE_TOKEN variable is not set
```

**Solution:** Ensure `.env` exists in root directory:

```bash
ls -la .env
cp .env.example .env  # If missing
```

---

## Common Commands

### View Running Containers

```bash
docker ps
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs absensi-app

# Follow logs (live)
docker-compose logs -f
```

### Execute Commands in Container

```bash
# Open shell
docker-compose exec absensi-app sh

# Run command
docker-compose exec absensi-app pnpm --version
```

### Stop & Remove

```bash
# Stop (keeps containers)
docker-compose stop

# Remove (delete containers)
docker-compose down

# Remove with volumes
docker-compose down -v
```

### Rebuild

```bash
# Rebuild image (after code changes)
docker-compose build --no-cache

# Rebuild and start
docker-compose up --build
```

---

## Troubleshooting

### Port Already in Use

```bash
# Change port in docker-compose.yml
# From: "5000:5000"
# To:   "5001:5000"

docker-compose up
```

### Build Fails

```bash
# Clear cache and rebuild
docker-compose build --no-cache

# Check Docker disk space
docker system df
docker system prune  # Clean up unused images
```

### Container Won't Start

```bash
# Check logs
docker-compose logs absensi-app

# Verify health
docker-compose ps
```

### Connection to Supabase Failed

```bash
# Verify environment variables
docker-compose exec absensi-app env | grep SUPABASE

# Check inside container
docker-compose exec absensi-app curl -I http://localhost:5000/health
```

---

## Optional: Cloudflare Tunnel (VPS with NAT)

For VPS behind NAT or restricted firewall, use Cloudflare Tunnel to expose application securely without direct port exposure.

### Ports vs Expose

- **`ports:`** - Exposes port on host machine (need for local access)
  - Use for: Local development, direct testing
- **`expose:`** - Only visible to container network (not host)
  - Use for: VPS with reverse proxy/tunnel (safer)

### Setup

1. **Create tunnel at [Cloudflare Dashboard](https://dash.cloudflare.com/)**
   - Go to "Zero Trust" → "Access" → "Tunnels"
   - Create tunnel named `absensi-tunnel`
   - Copy both **Tunnel Token** and **Tunnel ID** from credentials

2. **Add to `.env`:**

   ```env
   CLOUDFLARE_TOKEN=your_tunnel_token_here
   CLOUDFLARE_TUNNEL_ID=your_tunnel_id_here
   ```

3. **Update docker-compose.yml:**
   - Comment out `ports:` section
   - Uncomment `expose:` section in `absensi-app`

   ```yaml
   # ports:
   #   - "5000:5000"
   expose:
     - "5000"
   ```

4. **Start with tunnel:**

   ```bash
   docker-compose --profile vpn up -d
   ```

5. **Verify:**
   ```bash
   docker-compose logs -f cloudflared
   ```

Your app is now accessible through Cloudflare URL instead of direct IP:port

---

## Development with Docker

### Option 1: Hot Reload (Recommended for Development)

Mount your code as volume:

**docker-compose.override.yml:**

```yaml
version: "3.8"

services:
  absensi-app:
    volumes:
      - .:/app
      - /app/node_modules
    command: pnpm run dev
    environment:
      - NODE_ENV=development
```

Then run:

```bash
docker-compose up
```

### Option 2: Without Hot Reload

Just use regular `docker-compose up` (production-like environment)

---

## Deployment

### Option 1: Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag image
docker tag absensi-app username/absensi-app:latest

# Push
docker push username/absensi-app:latest

# On server: pull and run
docker pull username/absensi-app:latest
docker run -p 5000:5000 username/absensi-app:latest
```

### Option 2: Railway.app (Recommended)

1. Push code to GitHub
2. Create account at [Railway.app](https://railway.app)
3. Connect GitHub repository
4. Add environment variables
5. Deploy (automatic)

### Option 3: Docker Registry

Supported by most cloud providers:

- Google Cloud Run
- AWS ECR
- Azure Container Registry
- DigitalOcean

---

## Performance Tips

### Image Size Optimization

Current image size: ~500MB (optimized with Alpine Linux + multi-stage build)

**Current optimizations:**

- ✅ Alpine Linux base
- ✅ Multi-stage build (builder + runtime)
- ✅ Frozen lockfile
- ✅ Production dependencies only
- ✅ .dockerignore configured

### Caching

```bash
# Layer caching is automatic
# Rebuilds are faster if code unchanged
docker-compose up --build

# Force fresh build (no cache)
docker-compose build --no-cache
```

### Health Checks

Docker Compose includes health check:

- Tests `/health` endpoint every 30 seconds
- Marks container healthy after 40 seconds
- Restarts on failure

---

## File Structure

```
project-root/
├── Dockerfile                 # Main Docker image
├── docker-compose.yml         # Docker Compose config
├── .dockerignore              # Files to exclude
├── .env.docker                # Template env vars
├── DOCKER.md                  # This file
├── packages/
│   ├── backend/
│   ├── frontend/
│   └── shared/
└── ...
```

---

## Next Steps

1. **Test locally:** `docker-compose up`
2. **Deploy to Railway:** Push to GitHub, connect on Railway
3. **Monitor:** Check logs regularly
4. **Scale:** Add more containers if needed

---

## Support

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
