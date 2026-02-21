# Buydy

A comprehensive stock market data management and processing platform built with JavaScript/Node.js. Buydy provides real-time stock analysis, dividend tracking, technical indicators, and market scanning capabilities across multiple platforms.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Yarn package manager
- MongoDB

### Installation
```bash
# Install all dependencies
yarn install

# Validate environment setup
yarn validate:env
```

### Start Development

Development automatically uses SSH tunnel to connect to production MongoDB.

```bash
yarn stocks-api:dev    # API server (port 3001)
yarn web:dev          # Web dashboard (port 3000)
```

**See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for setup guide.**

### Access Points
- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001
- **API Health**: http://localhost:3001/health

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[docs/INDEX.md](docs/INDEX.md)** | Complete documentation index |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System architecture |
| **[docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md)** | Environment setup guide |
| **[docs/DEV_TOOLS_GUIDE.md](docs/DEV_TOOLS_GUIDE.md)** | Development tools reference |
| **[apps/app-stocks-api/docs/](apps/app-stocks-api/docs/)** | API documentation |
| **[apps/app-stocks-scanner/](apps/app-stocks-scanner/)** | Job system docs |

**Can't find something?** → Check [docs/INDEX.md](docs/INDEX.md) for complete navigation.

---

## 📦 Project Structure

This is a **monorepo** with multiple applications and shared packages:

### Applications (`apps/`)

| App | Description | Port |
|-----|-------------|------|
| **app-stocks-api** | REST API server for stock data and job management | 3001 |
| **app-stocks-web** | React web dashboard with Vite | 3000 |
| **app-stocks-scanner** | Background job processing system | - |

### Packages (`packages/`)

| Category | Packages |
|----------|----------|
| **client/** | UI components (button, table, select, slider, http-client) |
| **server/** | Backend utilities (database, EODHD API, logger, auth) |
| **iso/** | Isomorphic shared logic (auth-utils, async-queue, business-types) |
| **dev/** | Development tools (CD, environment validation, monorepo utils, prettier-lint) |

---

## 🔧 Development

### Environment Configuration

**Location**: Root-level `.env.dev` and `.env.production`  
**Access**: Apps use symlinks to these files

```bash
# Edit environment variables
vim .env.dev          # Development
vim .env.production   # Production

# Validate setup
yarn validate:env
```

**See [docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md) for complete guide.**

### Development Commands

```bash
# Start all apps
yarn dev:all

# Individual apps (all use SSH tunnel automatically)
yarn stocks-api:dev
yarn web:dev
yarn stocks:dev

# Code quality
yarn prettier-lint:all  # Format and lint all packages
yarn test:all           # Run all tests
yarn pre-push           # Pre-push validation (env + lint + test)

# Environment
yarn validate:env       # Validate environment symlinks

# Documentation
yarn docs:update-api    # Update API documentation
```

### Adding a New App to dev:all

Edit `package.json` and add to the workspace list:

```json
{
  "dev:all": "yarn workspaces foreach -pi --include '{@buydy/app-stocks-api,@buydy/app-stocks-web,@buydy/your-new-app}' run dev"
}
```

**See [docs/DEV_TOOLS_GUIDE.md](docs/DEV_TOOLS_GUIDE.md) for more.**

---

## 🧪 Testing

```bash
# All tests
yarn test:all

# Individual workspace
yarn workspace @buydy/app-stocks-api test
yarn workspace @buydy/app-stocks-web test

# Specific test
yarn stocks:test:metrics-enum
```

---

## 🚢 Deployment

```bash
# Quick deploy scanner (from root)
yarn release

# Or from app directory
cd apps/app-stocks-scanner
yarn release

# Process:
# 1. Validates environment ✅
# 2. Builds Docker image
# 3. Uploads to server
# 4. Deploys container
# 5. Cleans up old releases
```

**See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for complete production guide.**  
**See [packages/dev/dv-cd/README.md](packages/dev/dv-cd/README.md) for CD tools.**

---

## ✨ Key Features

- **Real-time Stock Data**: Integration with EODHD API for global market data
- **Automated Analysis**: Background jobs for fundamental and technical analysis
- **Large Cap Focus**: Efficient processing of stocks with ≥$1B market cap
- **Dividend Tracking**: Automated dividend data collection and analysis
- **Technical Indicators**: RSI, MACD, moving averages, and more
- **Multi-platform**: Web and API access
- **Job Management**: Comprehensive scheduling and monitoring
- **Metrics Heatmap**: Visual company performance comparison
- **Priority Queue**: Smart HTTP request management with caching

---

## 🏗️ Architecture

**Pattern**: Microservices with sequential data processing  
**Flow**: Fundamentals → Large Cap ID → Dividends → Technicals (monthly)  
**Strategy**: Only process confirmed large-cap stocks for efficiency

**Key Principles**:
- Centralized business logic in shared packages
- Environment configuration at root level
- Workspace-based monorepo structure
- Automated validation and testing

**See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture.**

---

## 🛠️ Troubleshooting

### Port Conflicts
```bash
# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Or use dev:all (automatically cleans up ports)
yarn dev:all
```

### Environment Issues
```bash
# Validate setup
yarn validate:env

# Fix missing symlinks
cd apps/your-app
ln -s ../../.env.dev .env.dev
ln -s ../../.env.production .env.production
```

### Database Connection
- **Local Development**: Uses SSH tunnel automatically, see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- **Production**: MongoDB runs on droplet with authentication
- Test connection: `yarn stocks-api:dev` (should show "✅ Database connected")

### Yarn Version Issues
```bash
# Enable Corepack for Yarn v4
corepack enable
```

**More help**: Check [docs/METRICS_HEATMAP_TROUBLESHOOTING.md](docs/METRICS_HEATMAP_TROUBLESHOOTING.md) and [docs/DEV_TOOLS_GUIDE.md](docs/DEV_TOOLS_GUIDE.md)

---

## 📝 Contributing

### Code Style
1. Follow ESLint and Prettier configuration
2. Use descriptive, goal-oriented function names
3. Organize files into logical folders
4. Run `yarn prettier-lint:all` before committing

### Documentation
1. Update docs when making changes
2. Add examples for new features
3. Keep API documentation current
4. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines

### Workflow
```bash
# Before committing
yarn prettier-lint:all  # Format and lint
yarn test:all           # Run tests
yarn validate:env       # Validate environment

# Or use pre-push hook (runs automatically)
git push
```

---

## 📞 Support

- **Documentation Index**: [docs/INDEX.md](docs/INDEX.md)
- **Production Deployment**: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **API Reference**: [apps/app-stocks-api/docs/API_DOCUMENTATION.md](apps/app-stocks-api/docs/API_DOCUMENTATION.md)
- **Dev Tools**: [docs/DEV_TOOLS_GUIDE.md](docs/DEV_TOOLS_GUIDE.md)
- **Environment Setup**: [docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md)

---

## 📄 License

Private project - All rights reserved.

---

**Built with** ❤️ **using Node.js, React, MongoDB, and modern JavaScript**
