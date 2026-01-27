# Security Documentation

## Overview

This document outlines the security measures implemented in the Asset Tracker application to protect user data and prevent unauthorized access.

## Authentication

### NextAuth.js v5 (Auth.js)
- **Provider**: Credentials-based authentication
- **Session Strategy**: JWT (JSON Web Tokens)
- **Session Duration**: 30 days
- **Password Hashing**: bcrypt with 12 rounds

### Login Process
1. User submits username and password
2. Credentials validated against database
3. Password verified using bcrypt comparison
4. JWT token generated with user information
5. Session cookie set (HttpOnly, Secure in production)

### Failed Login Handling
- Failed login attempts are logged in audit trail
- No sensitive information disclosed in error messages
- Generic "Invalid username or password" message displayed

## Authorization

### Role-Based Access Control (RBAC)

The application implements a two-tier role system:

#### Admin Users (`isadmin: true`)
- Full access to all features
- Can create, edit, and delete all resources
- Can manage users
- Can access admin dashboard
- Can view audit logs

#### Regular Users
- View access to assets, accessories, licenses
- Can edit own profile
- Limited create/edit permissions based on business rules

#### Request Permission (`canrequest: true`)
- Users with this flag can request accessories
- Managed separately from admin role

### Permission Matrix

| Permission | Admin | Regular User | User with canRequest |
|-----------|-------|--------------|---------------------|
| View Assets | ✓ | ✓ | ✓ |
| Create/Edit/Delete Assets | ✓ | ✗ | ✗ |
| View Users | ✓ | ✓ | ✓ |
| Create/Edit/Delete Users | ✓ | Own profile only | Own profile only |
| View Accessories | ✓ | ✓ | ✓ |
| Request Accessories | ✓ | ✗ | ✓ |
| Manage Catalog (Manufacturers, Suppliers, etc.) | ✓ | ✗ | ✗ |

## API Security

### Authentication Checks
All API routes (except authentication endpoints) require a valid session:

```javascript
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";

// For authenticated endpoints
const user = await requireApiAuth();

// For admin-only endpoints
const admin = await requireApiAdmin();
```

### Error Responses
- **401 Unauthorized**: No valid session
- **403 Forbidden**: Insufficient permissions
- **400 Bad Request**: Validation errors

## Input Validation

### Zod Schema Validation
All user inputs are validated using Zod schemas before processing:

```javascript
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1),
});
```

### SQL Injection Prevention
- Prisma ORM used for all database operations
- Parameterized queries by default
- No raw SQL execution with user input

### XSS Prevention
- React automatically escapes output by default
- No `dangerouslySetInnerHTML` used
- Content-Security-Policy headers configured

## Session Management

### JWT Configuration
- **Algorithm**: HS256
- **Secret**: 256-bit random key (stored in environment variable)
- **Expiration**: 30 days
- **Refresh**: Automatic on activity

### Cookie Settings
- **HttpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: HTTPS-only in production
- **SameSite**: Lax (CSRF protection)
- **Path**: / (application-wide)

## Security Headers

The following security headers are configured in `next.config.mjs`:

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | max-age=63072000 | Enforce HTTPS |
| X-Frame-Options | SAMEORIGIN | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-XSS-Protection | 1; mode=block | Enable XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Restrict browser features |

## Audit Logging

### What is Logged
- Login attempts (successful and failed)
- User creation, modification, deletion
- Asset assignment/unassignment
- Administrative actions
- Permission changes

### Audit Log Contents
- **User ID**: Who performed the action
- **Action**: What was done (CREATE, UPDATE, DELETE, etc.)
- **Entity**: What was affected (user, asset, etc.)
- **Entity ID**: Specific record affected
- **Details**: Additional context (JSON)
- **IP Address**: Request origin
- **User Agent**: Browser/client information
- **Timestamp**: When it occurred

### Retention
- Audit logs are retained indefinitely
- Can be filtered by user, entity, action, or date
- Accessible only to administrators

## Password Policy

### Requirements
- Minimum 8 characters (recommended)
- Stored as bcrypt hash (12 rounds)
- Never stored in plain text
- Never logged or displayed

### Password Migration
Existing passwords were migrated from plain text to bcrypt using the migration script:
```bash
node scripts/migrate-passwords.js
```

### Password Reset
Not currently implemented. To reset a password:
1. Admin must manually update via database
2. Consider implementing password reset flow for production

## Environment Variables

### Required Variables
```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/assettracker

# NextAuth configuration
NEXTAUTH_URL=http://localhost:3000  # Production URL in production
NEXTAUTH_SECRET=<generated-secret>  # Generate with: openssl rand -base64 32
```

### Security Best Practices
- Never commit `.env` file to version control
- Use different secrets for each environment
- Rotate secrets regularly
- Use secret management service in production (AWS Secrets Manager, etc.)

## Threat Mitigation

### Protection Against Common Attacks

#### SQL Injection
- **Mitigation**: Prisma ORM with parameterized queries
- **Status**: ✓ Protected

#### Cross-Site Scripting (XSS)
- **Mitigation**: React auto-escaping, CSP headers, input validation
- **Status**: ✓ Protected

#### Cross-Site Request Forgery (CSRF)
- **Mitigation**: NextAuth.js built-in CSRF protection, SameSite cookies
- **Status**: ✓ Protected

#### Clickjacking
- **Mitigation**: X-Frame-Options header
- **Status**: ✓ Protected

#### Session Hijacking
- **Mitigation**: HttpOnly cookies, Secure flag, short-lived JWTs
- **Status**: ✓ Protected

#### Brute Force Attacks
- **Mitigation**: Rate limiting (to be implemented)
- **Status**: ⚠️ Recommended for production

#### Man-in-the-Middle (MITM)
- **Mitigation**: HTTPS only (production), HSTS header
- **Status**: ✓ Protected (when using HTTPS)

## Recommendations for Production

### High Priority
1. **Enable HTTPS**: Use SSL/TLS certificates (Let's Encrypt, CloudFlare, etc.)
2. **Implement Rate Limiting**: Prevent brute force attacks on login
3. **Password Reset Flow**: Allow users to reset forgotten passwords
4. **Multi-Factor Authentication (MFA)**: Add 2FA for admin accounts
5. **Session Timeout**: Add idle timeout for inactive sessions

### Medium Priority
6. **Password Complexity**: Enforce strong password requirements
7. **Account Lockout**: Lock accounts after N failed login attempts
8. **Security Monitoring**: Set up alerts for suspicious activity
9. **Regular Backups**: Automated database backups
10. **Dependency Scanning**: Regular `npm audit` and updates

### Nice to Have
11. **Security Scanning**: Automated penetration testing
12. **Intrusion Detection**: Monitor for unusual patterns
13. **DDoS Protection**: CloudFlare or similar service
14. **Secret Rotation**: Automated secret key rotation
15. **Compliance**: GDPR, SOC 2, or industry-specific requirements

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** open a public GitHub issue
2. Email: security@yourdomain.com (update with actual email)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work to resolve critical issues immediately.

## Security Checklist for Deployment

- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] Admin accounts use strong passwords
- [ ] Unnecessary user accounts removed
- [ ] Audit logs reviewed
- [ ] Security headers verified
- [ ] Rate limiting configured
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

## Version History

- **v1.0.0** (2024-01-27): Initial security implementation
  - NextAuth.js v5 integration
  - RBAC system
  - Audit logging
  - Security headers
  - Password hashing migration

---

Last Updated: 2024-01-27
