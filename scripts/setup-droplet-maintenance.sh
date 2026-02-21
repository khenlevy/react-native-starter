#!/bin/bash

# Setup Droplet Maintenance Script
# This script sets up automated maintenance tasks on the droplet

set -e

echo "🔧 Setting up droplet maintenance tasks..."

# Create maintenance directory
mkdir -p /opt/maintenance

# Create disk cleanup script
cat > /opt/maintenance/cleanup-disk.sh << 'EOF'
#!/bin/bash

# Automated Disk Cleanup Script
# Runs daily to prevent disk space issues

LOG_FILE="/opt/maintenance/cleanup-$(date +%Y%m%d).log"

echo "$(date): Starting disk cleanup..." >> "$LOG_FILE"

# Get current disk usage
USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "$(date): Current disk usage: ${USAGE}%" >> "$LOG_FILE"

# Only cleanup if usage is above 70%
if [ "$USAGE" -gt 70 ]; then
    echo "$(date): Disk usage above 70%, performing cleanup..." >> "$LOG_FILE"
    
    # Clean up old MongoDB backups
    cd /var/backups/mongo 2>/dev/null || exit 0
    ls -t *.gz 2>/dev/null | tail -n +3 | xargs -r rm -f
    find . -name "stocks-cluster-*" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    find . -name "pre_restore_backup_*" -mtime +3 -delete 2>/dev/null || true
    
    # Clean up old release files
    find /opt -name "releases" -type d 2>/dev/null | while read dir; do
        find "$dir" -maxdepth 1 -type d -name "[0-9]*" | sort -nr | tail -n +4 | xargs -r rm -rf
    done
    
    # Clean up Docker resources
    docker system prune -f
    docker volume prune -f
    
    # Clean up log files
    find /var/log -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find /var/log -name "*.gz" -mtime +30 -delete 2>/dev/null || true
    journalctl --vacuum-time=7d 2>/dev/null || true
    find /opt -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Get new disk usage
    NEW_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "$(date): Disk usage after cleanup: ${NEW_USAGE}%" >> "$LOG_FILE"
    
    # Send alert if still high
    if [ "$NEW_USAGE" -gt 85 ]; then
        echo "$(date): WARNING: Disk usage still above 85% after cleanup!" >> "$LOG_FILE"
        # You could add email notification here
    fi
else
    echo "$(date): Disk usage is acceptable (${USAGE}%), no cleanup needed" >> "$LOG_FILE"
fi

echo "$(date): Disk cleanup completed" >> "$LOG_FILE"

# Keep only last 30 days of logs
find /opt/maintenance -name "cleanup-*.log" -mtime +30 -delete 2>/dev/null || true
EOF

chmod +x /opt/maintenance/cleanup-disk.sh

# Create service health check script
cat > /opt/maintenance/check-services.sh << 'EOF'
#!/bin/bash

# Service Health Check Script
# Runs every 5 minutes to ensure services are running

LOG_FILE="/opt/maintenance/health-$(date +%Y%m%d).log"

check_service() {
    local service_name=$1
    local container_name=$2
    
    if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo "$(date): ✅ ${service_name} is running" >> "$LOG_FILE"
        return 0
    else
        echo "$(date): ❌ ${service_name} is not running, attempting restart..." >> "$LOG_FILE"
        
        # Try to restart the service
        case $service_name in
            "MongoDB")
                cd /opt/app-db/docker && docker compose up -d mongo
                ;;
            "App Stocks Scanner")
                # Restart scanner if it exists
                if [ -d "/opt/app-stocks-scanner" ]; then
                    cd /opt/app-stocks-scanner && docker compose up -d 2>/dev/null || true
                fi
                ;;
        esac
        
        # Check again after restart attempt
        sleep 10
        if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
            echo "$(date): ✅ ${service_name} restarted successfully" >> "$LOG_FILE"
        else
            echo "$(date): ❌ Failed to restart ${service_name}" >> "$LOG_FILE"
        fi
    fi
}

# Check MongoDB
check_service "MongoDB" "mongo"

# Check App Stocks Scanner
check_service "App Stocks Scanner" "app-stocks-scanner-app"

# Keep only last 7 days of health logs
find /opt/maintenance -name "health-*.log" -mtime +7 -delete 2>/dev/null || true
EOF

chmod +x /opt/maintenance/check-services.sh

# Setup cron jobs
echo "📅 Setting up cron jobs..."

# Add disk cleanup job (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/maintenance/cleanup-disk.sh") | crontab -

# Add service health check (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/maintenance/check-services.sh") | crontab -

# Add log rotation for maintenance logs (weekly)
(crontab -l 2>/dev/null; echo "0 3 * * 0 find /opt/maintenance -name '*.log' -mtime +30 -delete") | crontab -

echo "✅ Maintenance setup complete!"
echo ""
echo "📋 Scheduled tasks:"
echo "  - Disk cleanup: Daily at 2:00 AM"
echo "  - Service health check: Every 5 minutes"
echo "  - Log rotation: Weekly on Sunday at 3:00 AM"
echo ""
echo "📁 Maintenance files created in /opt/maintenance/"
echo "📊 Check logs with: tail -f /opt/maintenance/cleanup-$(date +%Y%m%d).log"
echo "🏥 Check health logs with: tail -f /opt/maintenance/health-$(date +%Y%m%d).log"
