# NextAuth.js Security Implementation - Deployment Guide

This guide walks through deploying the NextAuth.js security implementation that was added to the Asset Tracker application.

## Prerequisites

- PostgreSQL database running and accessible
- Node.js 18+ installed
- Database URL configured in environment variables
- Admin access to the application

## Step-by-Step Deployment

### 1. Backup Your Database

**⚠️ CRITICAL: Always backup before migrations!**

```bash
# PostgreSQL backup
pg_dump -U username -d assettracker -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Or if using Docker
docker exec postgres_container pg_dump -U username assettracker > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Set Environment Variables

Create or update `.env` file:

```bash
# Generate a secret key
openssl rand -base64 32

# Add to .env file
NEXTAUTH_URL=http://localhost:3000  # Use your production URL in production
NEXTAUTH_SECRET=<generated-secret-from-above>
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Security Notes:**
- Use different `NEXTAUTH_SECRET` for each environment
- Never commit `.env` to version control
- In production, use HTTPS URL for `NEXTAUTH_URL`

### 3. Install Dependencies

```bash
npm install --legacy-peer-deps
# or
npm install
```

**Packages Installed:**
- `next-auth@beta` - Authentication framework
- `bcryptjs` - Password hashing
- `zod` - Input validation

### 4. Run Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add-nextauth-tables

# Or for production
npx prisma migrate deploy
```

**This creates:**
- `accounts` table - OAuth account storage
- `sessions` table - Session management  
- `verification_tokens` table - Email verification
- `audit_logs` table - Security audit trail
- Relationships to existing `user` table

**Verify Migration:**
```bash
# Check tables were created
npx prisma studio
# Or connect to database and verify tables exist
```

### 5. Migrate Existing Passwords

**⚠️ CRITICAL: This is a one-time operation!**

The migration script will:
- Find all users with plain-text passwords
- Hash them with bcrypt (12 rounds)
- Update the database
- Skip already-hashed passwords

```bash
node scripts/migrate-passwords.js
```

**Expected Output:**
```
Starting password migration...
Found 10 users to process
✓ Migrated password for user: admin
✓ Migrated password for user: john.doe
...
=== Migration Complete ===
Total users: 10
Migrated: 10
Skipped (already hashed): 0
```

**Verify Passwords:**
```bash
# Check that passwords are now hashed (start with $2a$, $2b$, or $2y$)
psql -d assettracker -c "SELECT username, substring(password, 1, 10) as password_hash FROM \"user\" LIMIT 5;"
```

### 6. Test Authentication

#### Test 1: Login Page
```bash
# Start the application
npm run dev

# Navigate to http://localhost:3000/login
# Should see login form
```

#### Test 2: Login with Valid Credentials
1. Enter username and password from your database
2. Click "Sign In"
3. Should redirect to home page
4. User info should appear in navigation

#### Test 3: Protected Routes
```bash
# Without login, try accessing:
curl http://localhost:3000/assets
# Should redirect to /login

# With login, should access normally
```

#### Test 4: API Authentication
```bash
# Without auth
curl http://localhost:3000/api/manufacturer
# Should return 401 Unauthorized

# With auth (get cookie from browser)
curl http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
# Should return manufacturers list
```

#### Test 5: Admin-Only Endpoints
```bash
# As regular user
curl -X POST http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token=REGULAR_USER_TOKEN" \
  -d '{"manufacturername": "Test"}'
# Should return 403 Forbidden

# As admin
curl -X POST http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token=ADMIN_TOKEN" \
  -d '{"manufacturername": "Test"}'
# Should create manufacturer
```

### 7. Verify Audit Logging

```bash
# Check audit logs in database
psql -d assettracker -c "SELECT * FROM audit_logs ORDER BY \"createdAt\" DESC LIMIT 10;"

# Should see login attempts and actions
```

### 8. Security Verification

Use the penetration testing guide:
```bash
# Follow PENETRATION_TESTING.md
# Run security tests
# Verify all tests pass
```

### 9. Production Deployment

#### Additional Steps for Production:

1. **Enable HTTPS**
   ```bash
   # Update NEXTAUTH_URL
   NEXTAUTH_URL=https://yourdomain.com
   ```

2. **Rotate Secrets**
   ```bash
   # Generate new secret for production
   openssl rand -base64 32
   ```

3. **Configure Rate Limiting** (Optional but Recommended)
   ```bash
   # Install rate limiting package
   npm install express-rate-limit
   
   # Or use Upstash Redis for distributed rate limiting
   npm install @upstash/ratelimit @upstash/redis
   ```

4. **Set up Monitoring**
   - Monitor failed login attempts
   - Set up alerts for suspicious activity
   - Track audit logs

5. **Configure Backups**
   - Automated database backups
   - Backup retention policy
   - Test restore procedures

## Troubleshooting

### Issue: "Module not found: Can't resolve '@/auth'"

**Solution:**
```bash
# Ensure jsconfig.json has correct paths
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Issue: "Prisma Client did not initialize yet"

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate
```

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

### Issue: Login redirects to login page

**Solution:**
1. Check NEXTAUTH_SECRET is set
2. Verify password was migrated correctly
3. Check browser console for errors
4. Verify session cookie is being set

### Issue: "Unauthorized" on API calls

**Solution:**
1. Ensure user is logged in
2. Check session cookie is present
3. Verify middleware is configured correctly
4. Check API route has authentication guard

### Issue: Password migration script fails

**Solution:**
```bash
# Check database connection
npx prisma db pull

# Check for syntax errors
node --check scripts/migrate-passwords.js

# Run with debugging
node scripts/migrate-passwords.js 2>&1 | tee migration.log
```

## Rollback Procedure

If you need to rollback the changes:

### 1. Restore Database Backup
```bash
# PostgreSQL restore
pg_restore -U username -d assettracker backup_file.dump

# Or from SQL dump
psql -U username -d assettracker < backup_file.sql
```

### 2. Revert Code Changes
```bash
git checkout main  # or your previous branch
npm install --legacy-peer-deps
```

### 3. Remove Environment Variables
```bash
# Remove or comment out in .env
# NEXTAUTH_URL=...
# NEXTAUTH_SECRET=...
```

## Post-Deployment Checklist

- [ ] Database backup created and verified
- [ ] Prisma migration completed successfully
- [ ] Password migration completed
- [ ] All users can log in
- [ ] Protected routes require authentication
- [ ] Admin routes require admin role
- [ ] API endpoints require authentication
- [ ] Audit logs are being created
- [ ] Security headers present in responses
- [ ] Login failures are logged
- [ ] Sessions expire correctly
- [ ] Logout works properly
- [ ] HTTPS enabled (production only)
- [ ] Secrets are secure and not committed
- [ ] Monitoring and alerts configured
- [ ] Team trained on new auth system

## Next Steps

1. **User Training**
   - Notify users of new login system
   - Provide login instructions
   - Set up password reset process (if implemented)

2. **Security Audit**
   - Run penetration tests
   - Check for vulnerabilities
   - Review audit logs

3. **Monitoring**
   - Set up error tracking (Sentry, etc.)
   - Monitor failed login attempts
   - Alert on suspicious activity

4. **Enhancements** (Optional)
   - Implement rate limiting
   - Add password reset flow
   - Add multi-factor authentication
   - Create admin dashboard

## Support

For issues or questions:
- Check SECURITY.md for security documentation
- Check PENETRATION_TESTING.md for testing guide
- Review audit logs for debugging
- Contact the development team

---

**Remember:** Security is an ongoing process. Regularly update dependencies, review logs, and stay informed about security best practices.
