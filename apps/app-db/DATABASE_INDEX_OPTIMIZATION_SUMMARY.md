# Database Index Management

Indexes are automatically managed by the index infrastructure. See `packages/server/se-db/src/indexes/README.md` for details.

## Deployment Integration

Indexes are created automatically:

- ✅ On app startup (scanner & API) - uses fast-path optimization
- ✅ After database deployment - runs `scripts/create-optimal-indexes.js`

## Manual Index Creation

```bash
# Create all indexes manually
cd apps/app-db
yarn indexes:create
```

## Performance

Indexes improve query performance by **5-10x** for common operations:

- Heatmap sector/industry filtering: ~200-500ms (was 2-5s)
- Symbol lookups: ~100-300ms (was 1-2s)
