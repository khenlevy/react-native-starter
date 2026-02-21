FROM node:22-alpine AS deps
WORKDIR /repo

# Enable corepack for Yarn 4
RUN corepack enable

# Copy entire monorepo structure for workspace dependencies
COPY . .

# Install dependencies (allow lockfile modifications in Docker)
RUN yarn install

FROM node:22-alpine AS runner
WORKDIR /repo

# Add SSL certificates and OpenSSL (required by MongoDB)
RUN apk add --no-cache ca-certificates openssl

# Bring in everything from deps stage
COPY --from=deps /repo /repo

WORKDIR /repo/apps/app-stocks-api

# Copy environment file for production
COPY .env.production .env.production

EXPOSE 3001

# Set NODE_ENV to production
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
