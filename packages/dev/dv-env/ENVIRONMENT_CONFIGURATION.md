# Environment Configuration

## Overview

This project uses a centralized environment configuration system where all environment variables are managed at the root level and linked to individual apps via symlinks.

## Structure

```
Buydy/
├── .env.dev              # Development environment (root source of truth)
├── .env.production       # Production environment (root source of truth)
└── apps/
    ├── app-stocks-api/
    │   ├── .env.dev -> ../../.env.dev
    │   └── .env.production -> ../../.env.production
    ├── app-stocks-scanner/
    │   ├── .env.dev -> ../../.env.dev
    │   └── .env.production -> ../../.env.production
    └── app-stocks-web/
        ├── .env.dev -> ../../.env.dev
        └── .env.production -> ../../.env.production
```

## Why This Approach?

### ✅ Benefits

1. **Single Source of Truth**: All environment variables are defined in one place at the root level
2. **Consistency**: All apps automatically use the same configuration
3. **Easy Updates**: Change once at root, all apps get the update
4. **No Duplication**: No need to maintain separate `.env` files for each app
5. **Validation**: Automated checks ensure all apps have proper symlinks
6. **Environment-Specific**: Clear separation between dev and production configs

### 🔄 Direct Environment Injection

You asked: "Do we have to maintain .env? Cannot we inject the environment specific directly?"

**Answer**: Yes! We now directly use environment-specific files:
- `.env.dev` for development (instead of `.env`)
- `.env.production` for production

Apps should load the appropriate file based on `NODE_ENV` or `APP_ENV`:
```javascript
// Example in your app startup
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.dev';

require('dotenv').config({ path: envFile });
```

## File Descriptions

### `.env.dev` (Development)
- Used for local development
- Contains development database URLs
- Debug mode enabled
- Local API endpoints

### `.env.production` (Production)
- Used for production deployments
- Contains production database URLs
- Debug mode disabled
- Production API endpoints
- Includes deployment credentials (e.g., Digital Ocean)

## Usage

### For Development

When running your app locally:

```bash
# The app will automatically use .env.dev
yarn dev

# Or explicitly set NODE_ENV
NODE_ENV=development yarn start
```

### For Production

When deploying or running in production:

```bash
# The app will automatically use .env.production
NODE_ENV=production yarn start

# Or use the production scripts
yarn stocks:start:prod
```

## Validation

### Automatic Validation

The project includes automatic validation to ensure all apps have proper symlinks:

```bash
# Manually validate
yarn validate:env

# Also runs automatically on pre-push
```

### What Gets Checked

1. Each app directory has `.env.dev` symlink
2. Each app directory has `.env.production` symlink
3. Symlinks point to correct root files (`../../.env.dev` and `../../.env.production`)

### If Validation Fails

If you add a new app or symlinks are missing:

```bash
cd apps/your-new-app
ln -s ../../.env.dev .env.dev
ln -s ../../.env.production .env.production
```

## Git Tracking

### Tracked (Version Controlled)
- ✅ `/.env.dev` (root)
- ✅ `/.env.production` (root)
- ✅ Symlinks in app directories (as type changes)

### Ignored
- ❌ Any standalone `.env` files in app directories
- ❌ `apps/**/.env*` files that aren't symlinks
- ❌ `.env.local` and `.env.*.local` (local overrides)

## Adding a New App

When creating a new app in the monorepo:

1. Create your app directory:
   ```bash
   mkdir apps/app-my-new-app
   ```

2. Create symlinks:
   ```bash
   cd apps/app-my-new-app
   ln -s ../../.env.dev .env.dev
   ln -s ../../.env.production .env.production
   ```

3. Validate:
   ```bash
   yarn validate:env
   ```

## App-Specific Variables

If an app needs additional environment variables not shared with other apps:

1. **Option A**: Add them to the root files with app-specific prefixes:
   ```bash
   # In .env.dev
   MOBILE_SPECIFIC_VAR=value
   WEB_SPECIFIC_VAR=value
   ```

2. **Option B**: Create an additional `.env.local` in the app directory:
   ```bash
   # In apps/app-mobile/.env.local (not tracked by git)
   MOBILE_ONLY_VAR=value
   ```

   Then load both files:
   ```javascript
   require('dotenv').config({ path: '.env.dev' });
   require('dotenv').config({ path: '.env.local', override: true });
   ```

## Updating Environment Variables

### To update shared variables:

1. Edit root file:
   ```bash
   # Edit the appropriate file
   vim .env.dev          # For development
   vim .env.production   # For production
   ```

2. Changes automatically apply to all apps (via symlinks)

3. Restart your apps to pick up changes

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit secrets**: While `.env.dev` and `.env.production` are tracked, ensure sensitive values are properly secured
2. **Use environment-specific secrets**: Production secrets should never be in development files
3. **Consider using secret managers**: For production, consider using services like AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault
4. **Rotate credentials regularly**: Especially production database passwords and API keys

## Troubleshooting

### Symlink not working

**Problem**: App can't find environment variables

**Solution**:
```bash
cd apps/your-app
ls -la | grep env  # Check if symlinks exist and are correct
ln -sf ../../.env.dev .env.dev  # Recreate if needed
```

### Changes not reflecting

**Problem**: Updated root env file but app still has old values

**Solution**:
- Restart your app (environment variables are loaded at startup)
- Clear any caches
- Verify the symlink is correct: `readlink .env.dev`

### Validation fails

**Problem**: `yarn validate:env` reports errors

**Solution**:
- Read the error message carefully
- Run the suggested fix commands
- Ensure you're in the correct directory
- Check symlink targets: `readlink -f .env.dev`

## Migration Notes

### What Changed

**Before**:
- Each app had its own `.env`, `.env.development`, `.env.production`
- Variables duplicated across apps
- Easy to get out of sync

**After**:
- Root-level `.env.dev` and `.env.production`
- Apps use symlinks to root files
- Single source of truth
- Automated validation

### Old Files Removed

The following files were removed and replaced with symlinks:
- `apps/app-stocks-api/.env` → uses `apps/app-stocks-api/.env.dev`
- `apps/app-stocks-scanner/.env` → uses `apps/app-stocks-scanner/.env.dev`
- `apps/app-stocks-scanner/.env.production` → uses symlink

## Related Scripts

- `scripts/validate-env-symlinks.cjs`: Validation script
- `yarn validate:env`: Run validation manually
- `yarn pre-push`: Runs validation before pushing to git

## Questions?

If you have questions about the environment configuration:
1. Check this document first
2. Run `yarn validate:env` to ensure setup is correct
3. Check the git status: `git status | grep env`
4. Verify symlinks: `find apps -name ".env*" -ls`

