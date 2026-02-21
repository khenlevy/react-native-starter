#!/bin/bash

# Setup Local Environment for Database Debugging
# This script helps you set up a local environment to test the database connection issues

echo "🔧 Setting up local environment for database debugging..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "⚠️  Please edit .env file with your actual values"
    else
        echo "📝 Creating basic .env file..."
        cat > .env << EOF
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
# OR use individual components:
# MONGO_HOST=localhost
# MONGO_PORT=27017
# MONGO_USERNAME=your_username
# MONGO_PASSWORD=your_password
# MONGO_DATABASE=buydy_db

# EODHD API Configuration
API_EODHD_API_TOKEN=your_api_token_here

# Job Configuration
LARGE_CAP_COUNT=100
EOF
        echo "✅ Created basic .env file"
        echo "⚠️  Please edit .env file with your actual values"
    fi
else
    echo "✅ .env file already exists"
fi

# Check if MongoDB is running locally
echo "🔍 Checking if MongoDB is running locally..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        echo "✅ MongoDB is running locally"
    else
        echo "⚠️  MongoDB is not running locally"
        echo "   💡 Start MongoDB with: brew services start mongodb-community"
        echo "   💡 Or start with Docker: docker run -d -p 27017:27017 --name mongodb mongo:8.0"
    fi
else
    echo "⚠️  mongosh not found. Install MongoDB tools to test local connection"
fi

# Check if Node.js and dependencies are installed
echo "🔍 Checking Node.js setup..."
if command -v node &> /dev/null; then
    echo "✅ Node.js is installed: $(node --version)"
else
    echo "❌ Node.js is not installed"
    exit 1
fi

if [ -d "node_modules" ]; then
    echo "✅ Dependencies are installed"
else
    echo "📦 Installing dependencies..."
    yarn install
fi

echo ""
echo "🚀 Setup complete! Now you can:"
echo ""
echo "1. Edit .env file with your actual values:"
echo "   nano .env"
echo ""
echo "2. Run the debug script:"
echo "   node debug-db-connection.js"
echo ""
echo "3. Or run a specific job locally:"
echo "   node -e \"import('./src/jobs/all/exchanges/syncExchangesAndSymbols.js').then(m => m.syncExchangesAndSymbols())\""
echo ""
echo "4. Check your environment variables:"
echo "   cat .env"
echo ""
echo "💡 For production debugging, make sure to:"
echo "   - Set the correct MONGO_URL or MONGO_HOST/PASSWORD/USERNAME"
echo "   - Set the correct API_EODHD_API_TOKEN"
echo "   - Ensure network connectivity to your MongoDB instance"
