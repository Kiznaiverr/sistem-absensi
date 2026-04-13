# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all files
COPY . .

# Install dependencies for all packages
RUN pnpm install --frozen-lockfile

# Build frontend and backend
RUN pnpm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend only (frontend is built and served from backend/public)
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built frontend from builder
COPY --from=builder /app/packages/backend/public ./packages/backend/public

# Copy built backend from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start the server
WORKDIR /app/packages/backend
CMD ["node", "dist/server.js"]
