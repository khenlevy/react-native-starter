#!/bin/bash

set -e  # Exit on any error

# Set up non-interactive environment
export DEBIAN_FRONTEND=noninteractive
export DEBCONF_NONINTERACTIVE_SEEN=true
export DEBCONF_AUTO=5

echo "🔧 Docker Infrastructure Setup..."

# Function to check if Docker is properly installed
check_docker() {
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        echo "✅ Docker is already installed and running"
        return 0
    else
        echo "❌ Docker is not properly installed or not running"
        return 1
    fi
}

# Function to cleanup existing Docker installation
cleanup_docker() {
    echo "🧹 Cleaning up existing Docker installation..."
    
    # Stop and remove Docker containers
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
    
    # Remove Docker images (optional - comment out if you want to keep images)
    # docker rmi $(docker images -q) 2>/dev/null || true
    
    # Remove Docker networks (except default ones)
    docker network prune -f 2>/dev/null || true
    
    echo "✅ Docker cleanup completed"
}

# Function to reset Docker completely
reset_docker() {
    echo "🔄 Resetting Docker completely..."
    
    # Stop Docker service
    sudo systemctl stop docker 2>/dev/null || true
    
    # Remove Docker packages
    sudo apt-get remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
    sudo apt-get autoremove -y 2>/dev/null || true
    
    # Remove Docker data (WARNING: This will delete all containers, images, volumes)
    sudo rm -rf /var/lib/docker 2>/dev/null || true
    sudo rm -rf /etc/docker 2>/dev/null || true
    
    echo "✅ Docker reset completed"
}

# Check if reset is requested
if [ "$1" = "--reset" ]; then
    echo "🔄 Reset mode: Complete Docker reset requested"
    reset_docker
fi

# Check if cleanup is requested
if [ "$1" = "--cleanup" ]; then
    echo "🧹 Cleanup mode: Docker cleanup requested"
    cleanup_docker
    exit 0
fi

# Check if Docker is already properly installed
if check_docker; then
    echo "✅ Docker is ready. Skipping installation."
    
    # Ensure app network exists
    echo "🔧 Ensuring app network exists..."
    docker network create app-net 2>/dev/null || echo "Network 'app-net' already exists"
    
    echo "✅ Docker infrastructure is ready!"
    exit 0
fi

echo "🐳 Installing Docker (non-interactive, no config prompts)..."

# Fix any interrupted dpkg operations first (non-interactive)
echo "🔧 Checking for interrupted dpkg operations..."
export DEBIAN_FRONTEND=noninteractive
echo "1" | sudo dpkg --configure -a 2>/dev/null || true

# Update system packages
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y -o Dpkg::Options::="--force-confold"
sudo apt-get upgrade -y -o Dpkg::Options::="--force-confold"

# Install prerequisites
echo "📦 Installing prerequisites..."
sudo apt-get install -y \
  -o Dpkg::Options::="--force-confold" \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  apt-transport-https

# Add Docker's official GPG key (non-interactive)
echo "📦 Adding Docker's official GPG key..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --batch --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo "📦 Setting up Docker repository..."
# Handle Ubuntu 25.04 by using jammy (22.04) repository for compatibility
UBUNTU_CODENAME=$(lsb_release -cs)
UBUNTU_VERSION=$(lsb_release -rs)
if [ "$UBUNTU_CODENAME" = "noble" ] && [ "$(echo $UBUNTU_VERSION | cut -d. -f1)" = "25" ]; then
  # Ubuntu 25.04 (noble) - use jammy repository for Docker compatibility
  echo "⚠️  Ubuntu 25.04 detected, using jammy (22.04) repository for Docker compatibility"
  UBUNTU_CODENAME="jammy"
fi
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $UBUNTU_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine with retry mechanism
echo "📦 Installing Docker Engine..."
sudo apt-get update -y

# Try to install Docker packages with retries
for attempt in 1 2 3; do
    echo "📦 Attempt $attempt/3: Installing Docker packages..."
    if sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
        echo "✅ Docker packages installed successfully"
        break
    else
        if [ $attempt -lt 3 ]; then
            echo "⚠️  Installation attempt $attempt failed, retrying in 5 seconds..."
            sleep 5
            sudo apt-get update -y
        else
            echo "❌ Failed to install Docker packages after 3 attempts"
            exit 1
        fi
    fi
done

# Start and enable Docker service
echo "🔧 Starting and enabling Docker service..."
sudo systemctl start docker || {
    echo "⚠️  Failed to start Docker service, trying alternative method..."
    sudo service docker start || {
        echo "❌ Failed to start Docker service"
        exit 1
    }
}
sudo systemctl enable docker 2>/dev/null || echo "⚠️  Failed to enable Docker service (may already be enabled)"

# Add user to docker group
echo "👤 Adding user '$USER' to docker group..."
sudo groupadd docker 2>/dev/null || echo "Docker group already exists"
sudo usermod -aG docker $USER || echo "⚠️  Failed to add user to docker group (may already be member)"

# Create app network
echo "🔧 Creating app network..."
sudo docker network create app-net 2>/dev/null || echo "Network 'app-net' already exists"

# Verify installation
echo "🔍 Verifying Docker installation..."
if check_docker; then
    echo "✅ Docker installed and verified successfully!"
    echo "⚠️  You may need to log out and back in (or run 'newgrp docker') to use Docker without sudo."
    echo "🌐 Docker network 'app-net' created for app communication"
else
    echo "❌ Docker installation verification failed"
    exit 1
fi 