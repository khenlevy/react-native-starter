#!/bin/bash

# Deploy Maintenance Setup to Droplet
# This script uploads and sets up maintenance automation on the droplet

set -e

echo "🚀 Deploying maintenance setup to droplet..."

# Load environment variables
if [ -f .env.production ]; then
    source .env.production
else
    echo "❌ .env.production file not found"
    exit 1
fi

# Upload maintenance setup script
echo "📤 Uploading maintenance setup script..."
scp scripts/setup-droplet-maintenance.sh ${DO_DROPLET_USERNAME}@${DO_DROPLET_HOST}:/tmp/

# Execute maintenance setup on droplet
echo "🔧 Setting up maintenance on droplet..."
ssh ${DO_DROPLET_USERNAME}@${DO_DROPLET_HOST} << 'EOF'
    chmod +x /tmp/setup-droplet-maintenance.sh
    /tmp/setup-droplet-maintenance.sh
    rm /tmp/setup-droplet-maintenance.sh
EOF

echo "✅ Maintenance setup deployed successfully!"
echo ""
echo "🎯 Next steps:"
echo "  1. Monitor the maintenance logs: ssh ${DO_DROPLET_USERNAME}@${DO_DROPLET_HOST} 'tail -f /opt/maintenance/cleanup-$(date +%Y%m%d).log'"
echo "  2. Check service health: ssh ${DO_DROPLET_USERNAME}@${DO_DROPLET_HOST} 'tail -f /opt/maintenance/health-$(date +%Y%m%d).log'"
echo "  3. View scheduled tasks: ssh ${DO_DROPLET_USERNAME}@${DO_DROPLET_HOST} 'crontab -l'"
