# Scripts Directory

This directory contains utility scripts for managing the Buydy application.

## Available Scripts

- `dev-all.js` - Start all development services
- `monitor-cache-health.js` - Monitor and manage cache health
- `monitor-job-history.js` - Monitor and manage job history
- `update-api-docs.js` - Update API documentation

## MongoDB Operations

MongoDB backup and restore operations are handled through the `app-db` package. See `apps/app-db/README.md` for details.

**Quick Commands:**
```bash
# Navigate to app-db directory
cd apps/app-db

# Restore from latest backup
yarn restore

# List available backups
yarn restore:list

# Verify database state
yarn restore:verify

# Create manual backup
yarn backup
```