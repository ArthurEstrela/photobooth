# Stage 1: Build
FROM node:20-alpine AS builder

# Install dependencies for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy root monorepo files for workspace management
COPY package.json ./
# If there is a lockfile, copy it here (e.g., package-lock.json or pnpm-lock.yaml)

# Copy the api package and shared packages if they exist
# For this MVP, we assume api and shared are the main ones
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Install dependencies (using npm ci for reliability in CI)
RUN npm install

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

# Install runtime dependencies for Prisma and other native modules
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files to install production dependencies
COPY package.json ./
# Copy workspace packages package.json files to allow npm install --omit=dev
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built assets and prisma client from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["node", "apps/api/dist/main"]
