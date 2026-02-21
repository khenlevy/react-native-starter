# dv-prettier-lint

Unified lint and prettier runner for Buydy monorepo.

## Usage

```
yarn workspace dv-prettier-lint dv-prettier-lint-runner <client|server> [targetDir]
```

- `client` — Use client config (browser/React)
- `server` — Use server config (Node.js)
- `targetDir` — Directory to lint/format (defaults to current directory)

## Example

Lint and format a client package:

```
yarn workspace dv-prettier-lint dv-prettier-lint-runner client ../../packages/client
```

Lint and format a server package:

```
yarn workspace dv-prettier-lint dv-prettier-lint-runner server ../../packages/server
```

## How it works

- Runs ESLint and Prettier with the correct config for client or server
- Uses configs in `config/client` and `config/server`
- Exits with non-zero code if any check fails

## Add your own rules

Edit the config files in `config/client` or `config/server` as needed.

---

**Tip:** Add scripts to your app/package `package.json` for easier usage, e.g.:

```json
"scripts": {
  "lint": "yarn workspace dv-prettier-lint dv-prettier-lint-runner client ."
}
```
