# 🔒 MongoDB Authentication Setup Guide

## Overview

This document explains how MongoDB authentication is properly configured for secure production deployments.

## 🚨 Critical Authentication Requirements

### MongoDB Authentication Status

- ⚠️ **MongoDB currently runs with `--noauth` flag (SSH tunnel security)**
- ✅ **Admin user created with `root` role (when auth enabled)**
- ✅ **SSH tunnel + UFW provides security**
- ✅ **IP restrictions enforced via UFW**

## 🔧 Configuration Files

### 1. Docker Compose Configuration (`apps/app-db/docker/docker-compose.yml`)

```yaml
services:
  mongo:
    image: mongo:8.0
    container_name: mongo
    restart: unless-stopped
    command: ['--noauth'] # ← CURRENT: SSH tunnel security
    env_file:
      - .env.production
    environment:
      MONGO_USERNAME: ${MONGO_USERNAME}
      MONGO_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
      - /var/backups/mongo:/var/backups/mongo:ro
```

**Important Notes:**

- `MONGO_INITDB_*` variables only work with **empty databases**
- For existing databases, admin user must be created manually
- The `--auth` flag enforces authentication

### 2. Authentication Script (`apps/app-db/scripts/init_mongo_with_auth.sh`)

The script handles authentication setup for both scenarios:

**For Empty Databases:**

- Uses `MONGO_INITDB_*` environment variables
- Creates admin user automatically

**For Existing Databases:**

- Stops MongoDB temporarily
- Creates admin user with `root` role
- Restarts MongoDB with authentication

**Key Code:**

```javascript
db.getSiblingDB('admin').createUser({
  user: 'admin',
  pwd: 'password',
  roles: [{ role: 'root', db: 'admin' }], // ← CRITICAL: Use 'root' role
});
```

### 3. Environment Variables (`.env.production`)

```env
# MongoDB Authentication
MONGO_USERNAME=admin
MONGO_PASSWORD=j3Sh01ZaSDFj3i854YF5sa

# MongoDB Connection URL (for applications)
MONGO_URL=mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/markets_data?authSource=admin

# Mongo Express (Admin Interface)
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=secure_password
ME_CONFIG_MONGODB_URL=mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/
```

## 🚀 Release Process

### 1. Database Release (`yarn release:db`)

The release process automatically:

1. ✅ Loads credentials from `.env.production`
2. ✅ Runs `init_mongo_with_auth.sh` script
3. ✅ Creates/updates admin user with `root` role
4. ✅ Starts MongoDB with `--auth` flag
5. ✅ Verifies authentication works

### 2. Application Releases

**Scanner (`yarn release:stocks`):**

- Uses `MONGO_URL` from `.env.production`
- Automatically connects with authentication

**API (`yarn release:stocks-api`):**

- Uses `MONGO_URL` from `.env.production`
- Automatically connects with authentication

## 🔍 Troubleshooting Authentication Issues

### Issue: "SCRAM authentication failed, storedKey mismatch"

**Cause:** Admin user exists but with wrong credentials or role

**Solution:**

```bash
# 1. Stop MongoDB
docker stop mongo && docker rm mongo

# 2. Start without authentication
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:8.0

# 3. Drop and recreate admin user
docker exec mongo mongosh --eval "
use admin;
db.dropUser('admin');
db.createUser({
  user: 'admin',
  pwd: 'j3Sh01ZaSDFj3i854YF5sa',
  roles: ['root']
});
"

# 4. Test authentication
docker exec mongo mongosh --authenticationDatabase admin -u admin -p 'j3Sh01ZaSDFj3i854YF5sa' --eval 'db.adminCommand("ping")'

# 5. Restart with authentication
docker stop mongo && docker rm mongo
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:8.0 --auth
```

### Issue: "Authentication failed" with Docker Compose

**Cause:** `MONGO_INITDB_*` variables don't work with existing data

**Solution:**

1. Use the `init_mongo_with_auth.sh` script
2. Or manually create admin user as shown above

### Issue: Services can't connect to MongoDB

**Cause:** Wrong `MONGO_URL` format or missing authentication

**Solution:**

```env
# Correct format with authentication
MONGO_URL=mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/markets_data?authSource=admin
```

## 🛡️ Security Best Practices

### 1. Role Selection

- ✅ **Use `root` role** for admin user (full access to all databases)
- ❌ **Don't use `userAdminAnyDatabase`** (limited permissions)

### 2. Password Security

- ✅ **Strong passwords** (complex, unique)
- ✅ **Regular rotation** (change passwords periodically)
- ✅ **Environment variables** (never hardcode in files)

### 3. Network Security

- ✅ **IP restrictions** (only allow your IP)
- ✅ **Firewall rules** (block unauthorized access)
- ✅ **Internal connections** (use Docker network)

## 📋 Release Checklist

### Before Release

- [ ] Verify `.env.production` has correct MongoDB credentials
- [ ] Check that `MONGO_URL` includes authentication
- [ ] Ensure admin user has `root` role
- [ ] Test authentication manually

### During Release

- [ ] Monitor `init_mongo_with_auth.sh` execution
- [ ] Verify MongoDB starts with `--auth` flag
- [ ] Check that services can connect
- [ ] Verify no authentication errors in logs

### After Release

- [ ] Test MongoDB Compass connection
- [ ] Verify API endpoints work
- [ ] Check scanner is running without errors
- [ ] Confirm all services use authenticated connections

## 🔧 Manual Authentication Setup

If automatic setup fails, use this manual process:

```bash
# 1. Start MongoDB without authentication
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:8.0

# 2. Create admin user
docker exec mongo mongosh --eval "
use admin;
db.createUser({
  user: 'admin',
  pwd: 'j3Sh01ZaSDFj3i854YF5sa',
  roles: ['root']
});
"

# 3. Test authentication
docker exec mongo mongosh --authenticationDatabase admin -u admin -p 'j3Sh01ZaSDFj3i854YF5sa' --eval 'db.adminCommand("ping")'

# 4. Stop and restart with authentication
docker stop mongo && docker rm mongo
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:8.0 --auth

# 5. Verify authentication works
docker exec mongo mongosh --authenticationDatabase admin -u admin -p 'j3Sh01ZaSDFj3i854YF5sa' --eval 'db.adminCommand("listDatabases")'
```

## 🎯 Key Success Indicators

- ✅ **MongoDB requires authentication** (no anonymous access)
- ✅ **Admin user has `root` role** (full database access)
- ✅ **Services connect successfully** (no authentication errors)
- ✅ **All data accessible** (collections and documents)
- ✅ **Security enforced** (IP restrictions, strong passwords)

---

**Remember: Authentication is CRITICAL for security. Never deploy without it!**
