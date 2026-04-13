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

## Configuration

Docker Compose automatically reads environment variables from `packages/backend/.env` (your existing development file).

**Make sure `.env` exists at:**

```
packages/backend/.env
```

**With these required values:**

```env
NODE_ENV=development (or production)
SERVER_PORT=5000
SUPABASE_URL=your_url
SUPABASE_SECRET_KEY=your_key
JWT_SECRET=your_secret
# ... other variables
```

Then run:

```bash
docker compose up --build
```

**No need to copy files!** Docker will automatically load environment variables from the existing `packages/backend/.env` file.

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
