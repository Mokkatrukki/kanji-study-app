# ---- Stage 1: Build Frontend Assets ----
FROM node:20 AS frontend-builder
WORKDIR /app

# Copy only necessary files for frontend build
COPY package.json package-lock.json* tailwind.config.js tsconfig.client.json ./
COPY src/styles/input.css ./src/styles/
COPY src/public/ts/script.ts ./src/public/ts/

# Install dependencies and build frontend assets
RUN npm install --production=false # Need devDependencies for build
RUN npm run build:css
RUN npm run build:ts:client

# ---- Stage 2: Build Backend ----
FROM node:20 AS backend-builder
WORKDIR /app

# Copy only necessary files for backend build
COPY package.json package-lock.json* tsconfig.server.json ./
COPY src ./src

# Install dependencies and build backend
RUN npm install --production=false # Need devDependencies for build
RUN npm run build:ts:server

# ---- Stage 3: Production ----
FROM node:20-slim
WORKDIR /app

# Copy necessary files from previous stages
COPY package.json package-lock.json* ./
COPY .env ./.env # Copy environment variables
COPY --from=frontend-builder /app/src/public/css ./src/public/css
COPY --from=frontend-builder /app/src/public/js ./src/public/js
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/src/views ./src/views
# COPY --from=backend-builder /app/src/public/ts ./src/public/ts # Source TS likely not needed
# COPY --from=backend-builder /app/src/styles ./src/styles # Source styles likely not needed

# Install only production dependencies
RUN npm install --omit=dev

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["node", "dist/server.js"] 