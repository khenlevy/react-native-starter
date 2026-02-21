FROM node:22-alpine AS deps
WORKDIR /repo

# Copy entire monorepo structure for workspace dependencies
COPY . .

# Enable Yarn via Corepack and install all dependencies in node_modules mode
# Corepack will use the version specified in package.json (yarn@4.9.2)
RUN corepack enable && yarn install

FROM node:22-alpine AS runner
WORKDIR /repo

# Add SSL certificates, OpenSSL (required by MongoDB), and timezone data
RUN apk add --no-cache ca-certificates openssl tzdata

# Bring in everything from deps stage
COPY --from=deps /repo /repo

WORKDIR /repo/apps/app-stocks-scanner

# Copy environment file for production
# The environment loader will automatically detect NODE_ENV=production and use .env.production
COPY .env.production .env.production

EXPOSE 4001

# Set NODE_ENV to production and timezone to America/Chicago
ENV NODE_ENV=production
ENV TZ=America/Chicago

CMD ["node", "--max-old-space-size=375", "--expose-gc", "index.js"]