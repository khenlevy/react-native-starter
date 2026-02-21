# dv-monorepo

Monorepo utilities for Buydy development tools. This package provides common utilities that can be shared across development packages.

## Functions

### `findMonorepoRoot(currentDir)`

Finds the monorepo root directory by looking for package.json, apps, and packages directories.

**Parameters:**
- `currentDir` (string) - The directory to start searching from

**Returns:**
- `string` - The absolute path to the monorepo root

**Throws:**
- `Error` - If monorepo root cannot be found

**Example:**
```javascript
import { findMonorepoRoot } from '@buydy/dv-monorepo';

const monorepoRoot = findMonorepoRoot(process.cwd());
console.log(`Monorepo root: ${monorepoRoot}`);
```

### `shouldExcludeFile(filePath, baseDir, excludePatterns)`

Checks if a file should be excluded based on patterns.

**Parameters:**
- `filePath` (string) - The file path to check
- `baseDir` (string) - The base directory for relative path calculation
- `excludePatterns` (string[]) - Patterns to exclude

**Returns:**
- `boolean` - True if file should be excluded

**Example:**
```javascript
import { shouldExcludeFile } from '@buydy/dv-monorepo';

const shouldExclude = shouldExcludeFile('/path/to/file.js', '/base/dir', ['node_modules', '*.log']);
```

### `getAllFiles(dir, baseDir, excludePatterns, files = [])`

Recursively gets all files from a directory, excluding specified patterns.

**Parameters:**
- `dir` (string) - The directory to scan
- `baseDir` (string) - The base directory for relative path calculation
- `excludePatterns` (string[]) - Patterns to exclude
- `files` (string[]) - Array to collect files (used internally)

**Returns:**
- `string[]` - Array of file paths

**Example:**
```javascript
import { getAllFiles } from '@buydy/dv-monorepo';

const files = getAllFiles('/path/to/dir', '/base/dir', ['node_modules', '.git']);
```

### `getAppName()`

Gets the app name from the current package.json.

**Returns:**
- `string` - The app name (extracted from scoped package names)

**Example:**
```javascript
import { getAppName } from '@buydy/dv-monorepo';

const appName = getAppName(); // Returns "app-api" from "@buydy/app-api"
```

## Usage

This package is designed to be used by other development tools in the Buydy monorepo. It provides utilities that are commonly needed across different development packages.

## Dependencies

This package has no external dependencies and only includes Node.js built-in modules. 