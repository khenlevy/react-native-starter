# Metrics Completeness Integration Tests

The suite in `metricsCalculators.spec.js` is a guardrail for the production
metrics documents.  Each test loads the calculator directly, checks the
calculated value against the document stored in MongoDB, and fails if the
database is missing data that the calculator can produce.  Treat every failure
as “the data is stale or incomplete” rather than “the calculator is broken”
unless you can show otherwise.

## When a Test Fails

1. **Inspect the calculator output**
   ```bash
   NODE_ENV=production node ./scripts/inspect-metric.js <SYMBOL> <METRIC_ID>
   ```
   (Or run a quick inline script as we do during debugging.)  If the calculator
   returns `null`, the upstream data feed is really missing the signal—log it
   and move on.  If the calculator returns a number, continue.

2. **Refresh the source document**
   - Preferred path: rerun the jobs that populate the metric.
     ```bash
     DEV_MODE_COMPANY=<SYMBOL> DEV_MODE_LIMIT=1 yarn run:job:syncDividendsLargeCap
     DEV_MODE_COMPANY=<SYMBOL> DEV_MODE_LIMIT=1 yarn run:job:syncMetricsLargeCap
     ```
     Follow up with the percentile jobs if those tests are failing.
   - Emergency path: write the value directly into MongoDB (only when you need
     an immediate unblock and know the calculator has already produced the
     “true” result).

3. **Re-run the specific tests**
   ```bash
   yarn test:int --testNamePattern "<SYMBOL>.*<METRIC>"
   ```
   Once the targeted test passes, run the full suite if you changed the code.

## Keeping The Tests Useful

- Avoid hard-coding “fixes” in the test.  The goal is to keep production data
  trustworthy.
- Prefer calculator improvements (better fallbacks, tolerant lookups) and data
  refreshes over Monkey-patching the database.
- Document unusual data issues directly in the repo (e.g. “this exchange does
  not publish dividends, expect null”).

Use this playbook whenever the metrics completeness tests start catching new
regressions.  Over time this will make the heatmap and scanners much more
consistent with our calculators.***

## Dividend Data Gap Handling

- The integration suite now skips dividend assertions when the `dividends`
  collection has no history for a symbol.  This mirrors the production job,
  which cannot calculate dividend metrics without that feed.
- If a dividend test is passing because it was skipped, confirm the gap by
  checking MongoDB:
  ```bash
  NODE_ENV=development node --input-type=module -e "
  import { loadEnvironmentVariables } from './apps/app-stocks-scanner/src/config/envLoader.js';
  import { ensureConnected, getModel, closeDatabase } from '@buydy/se-db';
  process.env.NODE_ENV='development';
  loadEnvironmentVariables();
  await ensureConnected();
  const Dividends = getModel('dividends');
  const doc = await Dividends.findOne({ symbol: '<SYMBOL>' }).lean().exec();
  console.log(doc?.history?.length);
  await closeDatabase();"
  ```
- Once the upstream dividend data is available (history length > 0), the tests
  will begin failing again if the calculated metric is still missing, so rerun
  the suite after refreshing data.

## Negative Equity Handling

- Companies reporting negative shareholder equity now receive a penalised raw
  value for `DebtToEquity*` metrics (we store the schema max of `100`), and the
  related change metrics record a `1000%` penalty change. This guarantees they
  rank at the bottom of the percentile distribution.
- If you see a very high raw D/E or change value in the DB, double-check the
  latest balance sheet. Persistent negative equity is usually the reason; rerun
  the fundamentals job only if you suspect the source feed is stale.

