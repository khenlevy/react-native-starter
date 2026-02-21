#!/bin/bash

# Script to remove .env files from git history and prevent future commits
# This ensures sensitive environment files are never committed to version control

set -euo pipefail

echo "🔒 Removing .env files from git history and securing repository..."

# Files to remove from git history
ENV_FILES=(
    ".env"
    ".env.production" 
    ".env.dev"
    ".env.local"
    ".env.staging"
    "apps/*/.env"
    "apps/*/.env.production"
    "apps/*/.env.dev"
    "apps/*/.env.local"
    "apps/*/.env.staging"
    "packages/*/.env"
    "packages/*/.env.production"
    "packages/*/.env.dev"
    "packages/*/.env.local"
    "packages/*/.env.staging"
)

# Remove files from git history
echo "🗑️  Removing .env files from git history..."
for file in "${ENV_FILES[@]}"; do
    if git ls-files | grep -q "^${file}$"; then
        echo "  Removing: ${file}"
        git filter-branch --force --index-filter \
            "git rm --cached --ignore-unmatch ${file}" \
            --prune-empty --tag-name-filter cat -- --all
    fi
done

# Force garbage collection to remove the files completely
echo "🧹 Cleaning up git repository..."
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Create/update .gitignore to prevent future commits
echo "📝 Updating .gitignore to prevent future .env commits..."
cat >> .gitignore << 'EOF'

# Environment files - NEVER COMMIT THESE
.env
.env.*
!.env.example
!.env.sample
!.env.template
apps/*/.env
apps/*/.env.*
packages/*/.env
packages/*/.env.*
**/.env
**/.env.*
!**/.env.example
!**/.env.sample
!**/.env.template
EOF

# Create a pre-commit hook to prevent .env commits
echo "🛡️  Creating pre-commit hook to prevent .env commits..."
mkdir -p .git/hooks

cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Pre-commit hook to prevent .env files from being committed
ENV_FILES=$(git diff --cached --name-only | grep -E '\.env$|\.env\.(production|dev|local|staging)$')

if [ -n "$ENV_FILES" ]; then
    echo "❌ SECURITY ERROR: Attempting to commit .env files!"
    echo "The following files contain sensitive information and cannot be committed:"
    echo "$ENV_FILES"
    echo ""
    echo "Please remove these files from your commit:"
    echo "  git reset HEAD <file>"
    echo ""
    echo "If you need to commit environment configuration, use .env.example or .env.template instead."
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit

# Create environment template files
echo "📋 Creating environment template files..."

# Root .env.template
cat > .env.template << 'EOF'
# Environment Configuration Template
# Copy this file to .env.production and fill in your actual values

# Database Configuration
MONGO_URL=mongodb://username:password@host:port/database
MONGO_DATABASE=your_database_name
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_strong_password
MONGO_HOST=your_host
MONGO_PORT=27017

# MongoDB Root Credentials
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=your_strong_mongodb_password

# AdminMongo Configuration
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=your_strong_password
MONGO_EXPRESS_SESSION_SECRET=your_session_secret
MONGO_EXPRESS_COOKIE_SECRET=your_cookie_secret

# Droplet Configuration
DO_DROPLET_HOST=your_droplet_ip
DO_DROPLET_USERNAME=root
DO_DROPLET_PASSWORD=your_ssh_password

# Security
ALLOWED_IP_ADDRESS=your_ip_address
EOF

# App-specific templates
for app in apps/*/; do
    if [ -d "$app" ]; then
        app_name=$(basename "$app")
        echo "  Creating template for $app_name"
        cp .env.template "$app/.env.template"
    fi
done

echo "✅ Git repository secured successfully!"
echo ""
echo "🔒 Security measures implemented:"
echo "  ✅ Removed .env files from git history"
echo "  ✅ Updated .gitignore to prevent future commits"
echo "  ✅ Created pre-commit hook to block .env commits"
echo "  ✅ Created environment templates"
echo ""
echo "📝 Next steps:"
echo "  1. Create your actual .env.production file from .env.template"
echo "  2. Never commit .env files again"
echo "  3. Use .env.template for sharing configuration structure"
echo ""
echo "⚠️  IMPORTANT: If you've already pushed .env files to a remote repository,"
echo "   you'll need to force push to update the remote history:"
echo "   git push --force-with-lease origin main"
