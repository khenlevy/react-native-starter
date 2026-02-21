# 🔒 Secure Release Process with MongoDB Authentication

## Overview
This document outlines the secure release process that ensures MongoDB authentication is properly configured and maintained across all deployments.

## 🚨 CRITICAL: Authentication Requirements

### MongoDB Authentication Status
- ✅ **MongoDB MUST run with `--auth` flag**
- ✅ **Admin user MUST be created with proper credentials**
- ✅ **All connections MUST use authentication**
- ✅ **IP restrictions MUST be enforced**

## 🔧 Release Process Steps

### 1. Pre-Release Verification
Before any release, verify the current authentication setup:

```bash
# Check MongoDB authentication status
ssh kl_droplet "docker exec mongo mongosh --authenticationDatabase admin -u admin -p 'j3Sh01ZaSDFj3i854YF5sa' --eval 'db.adminCommand(\"ping\")'"

# Check firewall rules
ssh kl_droplet "ufw status | grep 27017"

# Verify environment variables
grep MONGO_URL .env.production
```

### 2. Database Release (app-db)
The database release process is already configured for authentication:

**Files that ensure authentication:**
- `apps/app-db/docker/docker-compose.yml` - Contains `--auth` flag
- `apps/app-db/scripts/init_mongo_with_auth.sh` - Creates admin user
- `.env.production` - Contains credentials

**Release command:**
```bash
yarn release:db
```

### 3. API Release (app-stocks-api)
The API uses the `MONGO_URL` environment variable with authentication:

**Current configuration in `.env.production`:**
```
MONGO_URL=mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/markets_data?authSource=admin
```

**Release command:**
```bash
yarn release:stocks-api
```

### 4. Scanner Release (app-stocks-scanner)
The scanner also uses the `MONGO_URL` environment variable:

**Release command:**
```bash
yarn release:stocks
```

## 🛡️ Security Configuration

### Firewall Rules (UFW)
```bash
# Allow MongoDB access only from your IP
ufw allow from 172.56.89.241 to any port 27017
ufw deny 27017

# Allow other services
ufw allow from 172.56.89.241 to any port 22
ufw allow from 172.56.89.241 to any port 8081
ufw allow from 172.56.89.241 to any port 3000
ufw allow from 172.56.89.241 to any port 3001
```

### MongoDB Authentication
```bash
# Admin user credentials
MONGO_USERNAME=admin
MONGO_PASSWORD=j3Sh01ZaSDFj3i854YF5sa

# Connection strings
# For external access (MongoDB Compass):
mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@134.199.134.145:27017/admin

# For internal Docker access:
mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/markets_data?authSource=admin
```

### Authentication Setup Process
1. **Admin User Creation**: Uses `root` role (not `userAdminAnyDatabase`)
2. **Authentication Enforcement**: MongoDB runs with `--auth` flag
3. **Connection Security**: All connections require authentication
4. **Environment Variables**: Credentials loaded from `.env.production`

## 🔍 Troubleshooting Authentication Issues

### Issue: Authentication Failed
**Symptoms:**
- `MongoServerError: Authentication failed`
- `SCRAM authentication failed, storedKey mismatch`

**Solutions:**
1. **Reset MongoDB with fresh authentication:**
   ```bash
   ssh kl_droplet "docker stop mongo && docker rm mongo && docker volume rm mongo_data"
   yarn release:db
   ```

2. **Verify credentials in .env.production:**
   ```bash
   grep MONGO_INITDB .env.production
   ```

3. **Test authentication manually:**
   ```bash
   ssh kl_droplet "docker exec mongo mongosh --authenticationDatabase admin -u admin -p 'j3Sh01ZaSDFj3i854YF5sa' --eval 'db.adminCommand(\"ping\")'"
   ```

### Issue: Services Can't Connect
**Symptoms:**
- Scanner restarting
- API connection errors

**Solutions:**
1. **Verify MONGO_URL includes authentication:**
   ```bash
   grep MONGO_URL .env.production
   # Should show: mongodb://admin:j3Sh01ZaSDFj3i854YF5sa@mongo:27017/markets_data?authSource=admin
   ```

2. **Check if MongoDB is running with authentication:**
   ```bash
   ssh kl_droplet "docker ps | grep mongo"
   ssh kl_droplet "docker logs mongo --tail 5"
   ```

## 📋 Release Checklist

### Before Release
- [ ] Verify `.env.production` has correct MongoDB credentials
- [ ] Check firewall rules are properly configured
- [ ] Ensure MongoDB is running with authentication
- [ ] Test connection from your local machine

### During Release
- [ ] Monitor MongoDB authentication setup
- [ ] Verify all services can connect to MongoDB
- [ ] Check for any authentication errors in logs

### After Release
- [ ] Test MongoDB Compass connection
- [ ] Verify API endpoints work
- [ ] Check scanner is running without errors
- [ ] Confirm all services are using authenticated connections

## 🚀 Complete Release Commands

```bash
# 1. Release database with authentication
yarn release:db

# 2. Release scanner (uses authenticated MongoDB)
yarn release:stocks

# 3. Release API (uses authenticated MongoDB)
yarn release:stocks-api

# 4. Verify all services
ssh kl_droplet "docker ps"
```

## 🔐 Security Best Practices

1. **Always use authentication** - Never run MongoDB without `--auth`
2. **IP restrictions** - Only allow access from your IP
3. **Strong passwords** - Use complex, unique passwords
4. **Regular updates** - Keep MongoDB and Docker images updated
5. **Monitor logs** - Check for authentication failures
6. **Backup data** - Regular backups of MongoDB data

## 📞 Emergency Procedures

### If Authentication Completely Fails
1. **Stop all services:**
   ```bash
   ssh kl_droplet "docker stop \$(docker ps -q)"
   ```

2. **Reset MongoDB completely:**
   ```bash
   ssh kl_droplet "docker rm \$(docker ps -aq) && docker volume rm mongo_data"
   ```

3. **Re-release with fresh authentication:**
   ```bash
   yarn release:db
   ```

4. **Re-release other services:**
   ```bash
   yarn release:stocks
   yarn release:stocks-api
   ```

---

**Remember: Authentication is CRITICAL for security. Never deploy without it!**
