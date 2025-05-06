# Dockerfile for Kanji Study App (Consolidated)

# ---- Stage 1: Build Client-Side Assets (CSS, TS) ----
FROM node:20 AS client-builder
WORKDIR /app

# Copy config files needed for client build
COPY package.json package-lock.json* ./
COPY tailwind.config.js ./
COPY tsconfig.client.json ./
# Copy source files for client build
COPY src/styles/input.css ./src/styles/
COPY src/public/ts/script.ts ./src/public/ts/
COPY src/views ./src/views

# Install ALL dependencies (including dev needed for build)
# Ensure clean install if package-lock.json exists
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build CSS (output defined in package.json: dist/public/css)
RUN npm run build:css
# Build Client TS (output defined in tsconfig.client.json: dist/public/js)
RUN npm run build:ts:client

# ---- Stage 2: Build Server-Side TS & Copy Views ----
FROM node:20 AS server-builder
WORKDIR /app

# Copy config files needed for server build
COPY package.json package-lock.json* ./
COPY tsconfig.server.json ./
# Copy the entire src directory (including views)
COPY src ./src

# Install ALL dependencies (including dev needed for build)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build Server TS (output defined in tsconfig.server.json: dist)
RUN npm run build:ts:server
# Copy Views (output defined in package.json: dist/views)
# This step is crucial as tsc doesn't copy non-TS files
RUN npm run copy:views


# ---- Stage 3: Final Production Image ----
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary package files for production install
COPY package.json package-lock.json* ./

# Install ONLY production dependencies
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy built assets from previous stages
# Copy built CSS from client-builder stage
COPY --from=client-builder /app/dist/public/css ./dist/public/css
# Copy built client JS from client-builder stage
COPY --from=client-builder /app/dist/public/js ./dist/public/js
# Copy built server JS from server-builder stage
COPY --from=server-builder /app/dist ./dist
# Copy built views from server-builder stage (ensure views are within dist)
COPY --from=server-builder /app/dist/views ./dist/views

# Expose the port the app runs on (as defined in src/server.ts)
EXPOSE 3001

# Define the command to run the application using the start script
# The start script in package.json already includes dotenv preload
CMD ["npm", "start"] 