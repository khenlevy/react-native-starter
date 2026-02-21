# @buydy/iso-auth-utils

Isomorphic authentication utilities for Buydy applications. These functions can run on both client and server.

## Features

Pure JavaScript utility functions organized by domain:

### Validation
- `objectHasAllDefinedFields` - Check if an object has all specified fields defined (not null/undefined)
- `isValidEmailFormat` - Validate if a string matches the standard email format
- `formatUserDisplayName` - Format a user display name from various user data structures

### Security
- `removeSensitiveUserFields` - Remove sensitive properties (password, tokens) from user data for safe output
- `generateRandomAlphanumericString` - Generate a cryptographically strong random alphanumeric string

### Date
- `isTimestampExpired` - Check if a given timestamp is in the past (useful for any expiration)
- `getFutureTimestampFromSeconds` - Returns a timestamp representing current time plus given seconds

### Response
- `formatApiErrorResponse` - Format a standardized error object for API responses
- `formatApiSuccessResponse` - Format a standardized success object for API responses

## Usage

### Import individual functions

```javascript
const { isValidEmailFormat, generateRandomAlphanumericString } = require('@buydy/iso-auth-utils');

// Validate email
const isValid = isValidEmailFormat('user@example.com');

// Format user display name
const displayName = formatUserDisplayName(userData, 'google');

// Generate random string
const token = generateRandomAlphanumericString(32);
```

### Import all functions

```javascript
const authUtils = require('@buydy/iso-auth-utils');

// Check if object has all required fields
const validation = authUtils.objectHasAllDefinedFields(data, ['email', 'password']);

// Remove sensitive data
const cleanData = authUtils.removeSensitiveUserFields(rawUserData);

// Check if timestamp is expired
const isExpired = authUtils.isTimestampExpired(expiresAt);
```

## Development

```bash
# Run prettier-lint
yarn prettier-lint
```

## Isomorphic

This package is designed to work in both client and server environments. All functions are pure JavaScript with no external dependencies. 