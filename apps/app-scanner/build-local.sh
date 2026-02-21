#!/bin/bash

# Build Docker image locally (same as release process)
# This script replicates the exact build process used in the release script

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="app-stocks-scanner"
MONOREPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$MONOREPO_ROOT/apps/$APP_NAME"
BUILD_DIR="$APP_DIR/.build"
DOCKERFILE_PATH="$APP_DIR/Dockerfile"
TAR_FILE="$BUILD_DIR/$APP_NAME.tar"

echo -e "${BLUE}🚀 Building Docker image locally...${NC}"
echo -e "${BLUE}📦 Image name: $APP_NAME${NC}"
echo -e "${BLUE}📁 Working directory: $MONOREPO_ROOT${NC}"
echo -e "${BLUE}📂 App directory: $APP_DIR${NC}"
echo -e "${BLUE}🐳 Dockerfile path: $DOCKERFILE_PATH${NC}"

# Check if Docker is running
echo -e "${BLUE}🔍 Checking Docker daemon...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker daemon is running${NC}"

# Check local disk space
echo -e "${BLUE}💾 Checking local disk space...${NC}"
if command -v df >/dev/null 2>&1; then
    DISK_SPACE=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G.*//')
    echo -e "${BLUE}📊 Available disk space: ${DISK_SPACE}GB${NC}"
    if [ "$DISK_SPACE" -lt 5 ]; then
        echo -e "${YELLOW}⚠️  Low disk space detected locally${NC}"
    fi
fi

# Create build directory
echo -e "${BLUE}📂 Creating build directory...${NC}"
mkdir -p "$BUILD_DIR"

# Clean up existing tar file if it exists
if [ -f "$TAR_FILE" ]; then
    echo -e "${BLUE}🧹 Removing existing tar file...${NC}"
    rm -f "$TAR_FILE"
fi

# Build the Docker image
echo -e "${BLUE}🔨 Building image...${NC}"
cd "$MONOREPO_ROOT"
docker build --platform linux/amd64 -t "$APP_NAME" -f "$DOCKERFILE_PATH" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

# Save the image as tar file
echo -e "${BLUE}💾 Saving image as tar file...${NC}"
cd "$BUILD_DIR"
docker save "$APP_NAME" > "$APP_NAME.tar"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image saved as: $TAR_FILE${NC}"
else
    echo -e "${RED}❌ Failed to save image as tar file${NC}"
    exit 1
fi

# Show image info
echo -e "${BLUE}📊 Image information:${NC}"
docker images "$APP_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "${GREEN}🎉 Local build completed successfully!${NC}"

# Ask if user wants to run the image
echo -e "${BLUE}🚀 Starting the application locally...${NC}"
echo -e "${BLUE}📋 Running: docker run -p 4001:4001 --env-file $APP_DIR/.env $APP_NAME${NC}"

# Run the Docker container
docker run -p 4001:4001 --env-file "$APP_DIR/.env" "$APP_NAME"
