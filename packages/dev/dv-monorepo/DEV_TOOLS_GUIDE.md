# Development Tools Guide

Quick reference for using Buydy's development tools.

## 🚀 Quick Start

### Start All Development Servers
```bash
yarn dev:all
```

This starts in parallel:
- Stocks API (port 3001)
- Web Dashboard (port 3000)

**Using yarn workspaces** - simple and built-in!

**Features**:
- ✅ Parallel execution
- ✅ Interleaved output
- ✅ Graceful shutdown with Ctrl+C
- ✅ Easy to add/remove apps

### Validate Environment Configuration
```bash
yarn validate:env
```

Checks that all apps have proper `.env.dev` and `.env.production` symlinks.

---

## 📦 Development Packages

### `@buydy/dv-env`
Environment validation and management.

```bash
# Command line
dv-env-validate

# Programmatic
import { validateEnvironmentSymlinks } from '@buydy/dv-env';

const { allValid, results } = validateEnvironmentSymlinks();
```

### `@buydy/dv-cd`
Continuous deployment tools.

```bash
# Deploy to production
cd apps/app-name
yarn release

# Clean up old releases
yarn cleanup

# Docker utilities
yarn reset-docker
yarn cleanup-docker
```

### `@buydy/dv-monorepo`
Monorepo utilities including dev server runner.

```javascript
import { runDevelopmentServers } from '@buydy/dv-monorepo';

runDevelopmentServers({
  title: 'My Dev Environment',
  services: [/* ... */],
  ports: {/* ... */},
});
```

---

## 🔧 Configuration

### Adding Apps to `dev:all`

Edit `package.json` and add to the include list:

```json
{
  "dev:all": "yarn workspaces foreach -pi --include '{@buydy/app-stocks-api,@buydy/app-stocks-web,@buydy/app-stocks-scanner}' run dev"
}
```

That's it! Super simple.

### Workspace Patterns

```bash
# Specific apps (recommended)
yarn workspaces foreach -pi --include '{@buydy/app-stocks-api,@buydy/app-stocks-web}' run dev

# All apps (wildcard)
yarn workspaces foreach -pi --include '@buydy/app-*' run dev

# Single app
yarn workspace @buydy/app-stocks-api dev
```

### Flags

| Flag | Description |
|------|-------------|
| `-p` or `--parallel` | Run commands in parallel |
| `-i` or `--interlaced` | Interleave output line by line |
| `--include` | Filter which workspaces to run |

---

## 🎯 Common Tasks

### Start Individual Apps

```bash
# Stocks API only
yarn stocks-api:dev

# Web Dashboard only
yarn web:dev

# Scanner
yarn stocks:dev
```

### Environment Management

```bash
# Validate all apps
yarn validate:env

# Edit development env
vim .env.dev

# Edit production env
vim .env.production
```

### Code Quality

```bash
# Lint and format all packages
yarn prettier-lint:all

# Test all packages
yarn test:all

# Pre-push checks (runs automatically)
yarn pre-push
```

### Deployment

```bash
# From app directory
cd apps/app-stocks-scanner
yarn release

# What happens:
# 1. ✅ Validates environment
# 2. 🏗️  Builds Docker image
# 3. 📦 Uploads to server
# 4. 🚀 Deploys container
# 5. 🧹 Cleans up old releases
```

---

## 🔍 Troubleshooting

### Port Already in Use

The dev runner automatically cleans up ports, but if needed:

```bash
# Find process on port
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

### Environment Validation Fails

```bash
# Run validation
yarn validate:env

# Fix missing symlinks
cd apps/app-name
ln -s ../../.env.dev .env.dev
ln -s ../../.env.production .env.production

# Verify
yarn validate:env
```

### Dev Server Won't Start

```bash
# Check for errors
node scripts/dev-all.js

# Or start individually
yarn stocks-api:dev
yarn web:dev
```

### Yarn Version Issues

If you see yarn version warnings:

```bash
corepack enable
```

---

## 🧪 Testing Tools

### Environment Validation
```bash
# Test validation
node packages/dev/dv-env/bin/dv-env-validate.js

# Expected output:
# ✅ app-stocks-api: All environment symlinks valid
# ✅ app-stocks-scanner: All environment symlinks valid
# ✅ app-stocks-web: All environment symlinks valid
```

### Dev Server
```bash
# Test dev server
node scripts/dev-all.js

# Should start services with colored output
```

---

## 📚 Additional Resources

- [Environment Configuration Guide](./ENVIRONMENT_CONFIGURATION.md)
- [Environment Migration Summary](../ENV_MIGRATION_SUMMARY.md)
- [Refactoring Summary](../REFACTORING_DEV_TOOLS.md)
- Package READMEs in `packages/dev/`

---

## 🆘 Getting Help

If you run into issues:

1. Check this guide first
2. Review package READMEs
3. Check error messages (they include fix instructions)
4. Ask the team!

---

**Last Updated**: October 11, 2025

