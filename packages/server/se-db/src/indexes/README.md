# MongoDB Index Management

Automatic index creation and management for optimal database performance.

## Overview

Indexes are automatically created based on API query patterns. The system:

- ✅ Runs on every app startup (scanner & API)
- ✅ Only creates missing indexes (idempotent)
- ✅ Uses fast-path optimization (10x faster when indexes exist)
- ✅ Prioritizes critical indexes first
- ✅ Handles errors gracefully (non-blocking)

## How It Works

1. **On Startup**: `getDatabase()` → `ensureIndexes()`
2. **Fast-Path Check**: Samples `fundamentals` collection
   - If all indexes exist → Skip (10-50ms)
   - If missing → Full check (200-500ms)
3. **Index Creation**: Creates missing indexes with retry logic

## Index Priority

Indexes are prioritized by API usage:

- **Priority 1 (CRITICAL)**: Used in every request
- **Priority 2 (HIGH)**: Used frequently
- **Priority 3 (MEDIUM)**: Used occasionally
- **Priority 4 (LOW)**: Used rarely

## Key Features

- **Retry Logic**: 3 attempts with exponential backoff
- **Parallel Creation**: Up to 3 indexes simultaneously
- **Timeout Protection**: 5min timeout per index
- **Validation**: Verifies indexes after creation
- **Error Handling**: Distinguishes retryable vs permanent errors

## Adding New Indexes

Edit `indexRules.js`:

```javascript
fundamentals: [
  {
    fields: { fieldName: 1 },
    options: { unique: true }, // optional
    priority: 1, // 1-4, optional
  },
];
```

Indexes are created automatically on next startup.

## Performance

| Scenario                      | Time       |
| ----------------------------- | ---------- |
| All indexes exist (fast-path) | ~10-50ms   |
| Missing indexes (full check)  | ~200-500ms |
| Index creation (per index)    | ~1-30s     |

## Configuration

```javascript
await ensureIndexes(db, {
  skipQuickCheck: false, // Force full check
  parallel: true, // Enable parallel creation
  maxParallel: 3, // Max parallel indexes
  prioritize: true, // Use priority ordering
});
```

## Safety Guarantees

- ✅ Never modifies or deletes documents
- ✅ Never modifies or deletes existing indexes
- ✅ Only creates new indexes
- ✅ Non-blocking (background creation)
- ✅ Errors don't break database connection
- ✅ Fully idempotent

## Files

- `indexRules.js` - Index definitions (edit this to add indexes)
- `indexManager.js` - Index creation logic
- `index.js` - Public API exports
