# @buydy/dv-env

Environment validation and management for the Buydy monorepo.

## Overview

This package provides tools to validate that all apps in the monorepo have proper environment file symlinks pointing to the root-level `.env.dev` and `.env.production` files.

## Features

- ✅ Validates environment symlinks for all apps
- ✅ Ensures single source of truth for environment variables
- ✅ Integrates with CI/CD and pre-push hooks
- ✅ Clear error messages with fix instructions

## Usage

### Command Line

```bash
# Validate all apps
dv-env-validate

# Or via yarn from root
yarn validate:env
```

### Programmatic Usage

```javascript
import { validateEnvironmentSymlinks, getFixInstructions } from '@buydy/dv-env';

const { allValid, results } = validateEnvironmentSymlinks();

if (!allValid) {
  console.log('Validation failed!');
  console.log(getFixInstructions());
}
```

### In Pre-Release Hook

The validation automatically runs before deployments via the `dv-cd` release process.

## What It Validates

For each app in `apps/`, ensures:
1. `.env.dev` symlink exists and points to `../../.env.dev`
2. `.env.production` symlink exists and points to `../../.env.production`
3. Both are actual symbolic links (not regular files)

## Exit Codes

- `0` - All validations passed
- `1` - Validation failed or error occurred

## See Also

- [Environment Configuration Guide](../../../docs/ENVIRONMENT_CONFIGURATION.md)
- Root `.env.dev` and `.env.production` files

