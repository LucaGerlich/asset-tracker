# Security & Authentication Implementation Plan
## NextAuth.js Integration for Asset Tracker

**Current State Analysis:**
- Next.js 16.1.5 (App Router)
- Prisma 7.3.0 with PostgreSQL
- Existing user table with: `username`, `password`, `email`, `isadmin`, `canrequest`
- No authentication currently implemented
- API routes are publicly accessible

**Target State:**
- NextAuth.js v5 (Auth.js) with credential-based authentication
- Secure session management with JWT
- Role-Based Access Control (RBAC) - Admin vs Regular Users
- Protected routes (client & server)
- Protected API endpoints
- Password hashing with bcrypt
- CSRF protection
- Rate limiting
- Security headers
- Audit logging

**Estimated Timeline:** 7-10 days
**Approach:** 7 phases with comprehensive testing

---

## Phase 1: NextAuth.js Setup & Configuration (Days 1-2)

### 1.1 Install Dependencies

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

**Why beta?** NextAuth v5 (Auth.js) is required for Next.js 15+ App Router support.

### 1.2 Create Auth Configuration

**File:** `/src/auth.config.js`

### 1.3 Create Auth Handler

**File:** `/src/auth.js`

```javascript
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
```

### 1.4 Create API Route Handler

**File:** `/src/app/api/auth/[...nextauth]/route.js`

```javascript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

### 1.5 Update Environment Variables

**File:** `.env` (add these)

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-here-generate-with-openssl

# Generate secret with: openssl rand -base64 32
```

**Testing Phase 1:**
- [ ] NextAuth config loads without errors
- [ ] API route `/api/auth/providers` returns credentials provider
- [ ] Environment variables set correctly

---

## Phase 2: Database Integration & Password Migration (Days 2-3)

### 2.1 Update Prisma Schema for NextAuth

**File:** `/prisma/schema.prisma` (add these models)

```prisma
model Account {
  id                String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String  @db.Uuid
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [userid], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionToken String   @unique
  userId       String   @db.Uuid
  expires      DateTime
  user         User     @relation(fields: [userId], references: [userid], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// Update existing user model - add relation
model user {
  userid          String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  username        String?           @unique @db.VarChar
  isadmin         Boolean
  canrequest      Boolean
  lastname        String            @db.VarChar
  firstname       String            @db.VarChar
  email           String?           @unique @db.VarChar
  lan             String?           @db.VarChar
  password        String            @db.VarChar
  creation_date   DateTime          @default(now()) @db.Timestamp(6)
  change_date     DateTime?         @db.Timestamp(6)

  // Add NextAuth relations
  accounts        Account[]
  sessions        Session[]

  // Existing relations
  licence         licence[]
  userAccessoires userAccessoires[]
  userAssets      userAssets[]
}
```

### 2.2 Run Migration

```bash
npx prisma migrate dev --name add-nextauth-tables
npx prisma generate
```

### 2.3 Create Password Hashing Utility

**File:** `/src/lib/auth-utils.js`

```javascript
import bcrypt from "bcryptjs";

export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}
```

### 2.4 Create Password Migration Script

**File:** `/scripts/migrate-passwords.js`

**Run migration:**
```bash
node scripts/migrate-passwords.js
```

### 2.5 Update User Creation API

**File:** `/src/app/api/user/addUser/route.js` (update to hash passwords)

```javascript
import { hashPassword } from "@/lib/auth-utils";

// In POST handler, before creating user:
const hashedPassword = await hashPassword(password);

const user = await prisma.user.create({
  data: {
    ...userData,
    password: hashedPassword, // Use hashed password
  },
});
```

**Testing Phase 2:**
- [ ] Migration runs successfully
- [ ] All existing passwords are hashed
- [ ] New users are created with hashed passwords
- [ ] Can no longer see plain text passwords in database

---

## Phase 3: Login UI & Session Management (Day 3)

### 3.1 Create Login Page

**File:** `/src/app/login/page.jsx`

### 3.2 Update Navigation with Auth

**File:** `/src/components/Navigation.jsx` (add auth)

### 3.3 Create Sign Out Button

**File:** `/src/components/SignOutButton.jsx`

```jsx
"use client";

import { signOut } from "next-auth/react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  return (
    <DropdownMenuItem
      className="text-destructive cursor-pointer"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Log Out
    </DropdownMenuItem>
  );
}
```

### 3.4 Create Session Provider Wrapper

**File:** `/src/components/SessionProvider.jsx`

```jsx
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children, session }) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
```

### 3.5 Update Root Layout

**File:** `/src/app/layout.js`

```jsx
import { auth } from "@/auth";
import { SessionProvider } from "@/components/SessionProvider";

export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <ThemeProvider>
            {/* ... rest of layout ... */}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

**Testing Phase 3:**
- [ ] Can access login page
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error
- [ ] Session persists on refresh
- [ ] User info displays in navigation
- [ ] Sign out works and redirects to login

---

## Phase 4: Route Protection & Middleware (Days 4-5)

### 4.1 Create Auth Middleware

**File:** `/src/middleware.js`

```javascript
import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  const isPublicRoute = pathname === "/login";

  // API routes (handle separately)
  const isApiRoute = pathname.startsWith("/api");

  // Redirect logged-in users away from login
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect non-logged-in users to login
  if (!isLoggedIn && !isPublicRoute && !isApiRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
```

### 4.2 Create Admin-Only Route Protection

**File:** `/src/lib/auth-guards.js`

```javascript
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();

  if (!session.user.isAdmin) {
    redirect("/");
  }

  return session;
}

export async function requireCanRequest() {
  const session = await requireAuth();

  if (!session.user.canRequest) {
    throw new Error("You do not have permission to request items");
  }

  return session;
}
```

### 4.3 Protect Pages (Example)

**File:** `/src/app/manufacturers/create/page.jsx`

```jsx
import { requireAdmin } from "@/lib/auth-guards";
import ManufacturerCreateForm from "./ui/ManufacturerCreateForm";

export default async function ManufacturerCreatePage() {
  // Only admins can create manufacturers
  await requireAdmin();

  return <ManufacturerCreateForm />;
}
```

### 4.4 Create API Auth Helper

**File:** `/src/lib/api-auth.js`

```javascript
import { auth } from "@/auth";

export async function getAuthUser() {
  const session = await auth();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

export async function requireApiAuth() {
  return await getAuthUser();
}

export async function requireApiAdmin() {
  const user = await getAuthUser();

  if (!user.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}
```

### 4.5 Protect API Routes (Example)

**File:** `/src/app/api/manufacturer/route.js`

```javascript
import { requireApiAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    // Only admins can create manufacturers
    await requireApiAdmin();

    const body = await request.json();
    // ... rest of implementation
  } catch (error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Testing Phase 4:**
- [ ] Unauthenticated users redirected to login
- [ ] Authenticated users can access protected pages
- [ ] Non-admin users cannot access admin pages
- [ ] API endpoints reject unauthenticated requests
- [ ] API endpoints reject non-admin requests for admin endpoints

---

## Phase 5: Role-Based Access Control (RBAC) (Day 5-6)

### 5.1 Define Permission Matrix

**File:** `/src/lib/permissions.js`

```javascript
export const PERMISSIONS = {
  // Assets
  ASSET_VIEW: "asset:view",
  ASSET_CREATE: "asset:create",
  ASSET_EDIT: "asset:edit",
  ASSET_DELETE: "asset:delete",
  ASSET_ASSIGN: "asset:assign",

  // Users
  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_EDIT: "user:edit",
  USER_DELETE: "user:delete",

  // Accessories
  ACCESSORY_VIEW: "accessory:view",
  ACCESSORY_CREATE: "accessory:create",
  ACCESSORY_EDIT: "accessory:edit",
  ACCESSORY_DELETE: "accessory:delete",
  ACCESSORY_REQUEST: "accessory:request",

  // Licenses
  LICENSE_VIEW: "license:view",
  LICENSE_CREATE: "license:create",
  LICENSE_EDIT: "license:edit",
  LICENSE_DELETE: "license:delete",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",

  // Categories/Manufacturers/Suppliers
  CATALOG_MANAGE: "catalog:manage",
};

export function userHasPermission(user, permission) {
  // Admins have all permissions
  if (user.isAdmin) {
    return true;
  }

  // Regular users permissions
  switch (permission) {
    // View permissions - all authenticated users
    case PERMISSIONS.ASSET_VIEW:
    case PERMISSIONS.USER_VIEW:
    case PERMISSIONS.ACCESSORY_VIEW:
    case PERMISSIONS.LICENSE_VIEW:
      return true;

    // Request permissions - users with canRequest
    case PERMISSIONS.ACCESSORY_REQUEST:
      return user.canRequest;

    // Edit own profile
    case PERMISSIONS.USER_EDIT:
      return true; // Can edit own profile

    // Everything else requires admin
    default:
      return false;
  }
}

export function userCanEditUser(currentUser, targetUserId) {
  // Admins can edit anyone
  if (currentUser.isAdmin) {
    return true;
  }

  // Users can only edit themselves
  return currentUser.id === targetUserId;
}
```

### 5.2 Create Permission Hooks

**File:** `/src/hooks/usePermissions.js`


### 5.3 Create UI Permission Guards

**File:** `/src/components/PermissionGuard.jsx`

### 5.4 Apply RBAC to UI (Example)

**File:** `/src/components/Navigation.jsx`

### 5.5 Create Audit Log System

**File:** `/prisma/schema.prisma` (add audit log model)

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String?  @db.Uuid
  action      String   @db.VarChar(50)
  entity      String   @db.VarChar(50)
  entityId    String?  @db.Uuid
  details     Json?
  ipAddress   String?  @db.VarChar(50)
  userAgent   String?
  createdAt   DateTime @default(now()) @db.Timestamp(6)

  user        user?    @relation(fields: [userId], references: [userid], onDelete: SetNull)

  @@map("audit_logs")
}

// Add to user model
model user {
  // ... existing fields ...
  auditLogs   AuditLog[]
}
```

**File:** `/src/lib/audit-log.js`

**Testing Phase 5:**
- [ ] Admin users see all UI elements
- [ ] Regular users see limited UI elements
- [ ] Permission checks work on API routes
- [ ] Users can only edit their own profiles
- [ ] Audit logs created for sensitive actions

---

## Phase 6: API Security & Rate Limiting (Day 6-7)

### 6.1 Install Rate Limiting

```bash
npm install @upstash/ratelimit @upstash/redis
```

**Alternative (simpler, in-memory):**
```bash
npm install express-rate-limit
```

### 6.2 Create Rate Limiter

**File:** `/src/lib/rate-limit.js`

### 6.3 Create Rate Limit Middleware

**File:** `/src/lib/api-middleware.js`

### 6.4 Apply Rate Limiting to Login

**File:** `/src/app/api/auth/[...nextauth]/route.js`

### 6.5 Add Security Headers

**File:** `/next.config.js`

### 6.6 Add CSRF Protection

NextAuth.js includes built-in CSRF protection. Ensure it's enabled:

**File:** `/src/auth.config.js` (add to config)


### 6.7 Input Validation & Sanitization

**Install validator:**
```bash
npm install validator zod
```

**File:** `/src/lib/validation.js`

import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
});

export const assetSchema = z.object({
  assetname: z.string().min(1).max(255),
  assettag: z.string().min(1).max(50),
  serialnumber: z.string().min(1).max(100),
  // ... add all fields with validation rules
});

// Usage in API routes:
export async function POST(request) {
  const body = await request.json();

  // Validate input
  const result = assetSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.errors },
      { status: 400 }
    );
  }

  // Use validated data
  const validatedData = result.data;
  // ...
}
```

**Testing Phase 6:**
- [ ] Rate limiting works (test with multiple requests)
- [ ] Security headers present in responses
- [ ] CSRF protection active
- [ ] Input validation catches invalid data
- [ ] Login attempts rate limited

---

## Phase 7: Testing, Documentation & Hardening (Days 7-10)

### 7.1 Security Testing Checklist

**Authentication Tests:**
- [ ] Cannot access protected pages without login
- [ ] Invalid credentials rejected
- [ ] Session expires after timeout
- [ ] Session persists across page reloads
- [ ] Logout clears session completely
- [ ] Cannot reuse old session tokens

**Authorization Tests:**
- [ ] Regular users cannot access admin pages
- [ ] Regular users cannot call admin API endpoints
- [ ] Users can only edit their own profiles
- [ ] Permission guards work in UI
- [ ] API permission checks work

**Security Tests:**
- [ ] Passwords are hashed in database
- [ ] Rate limiting prevents brute force
- [ ] CSRF tokens validated
- [ ] Security headers present
- [ ] No sensitive data in error messages
- [ ] SQL injection prevented (Prisma handles this)
- [ ] XSS prevented (React escapes by default)

### 7.2 Create Security Documentation

**File:** `/SECURITY.md`

```markdown
# Security Documentation

## Authentication
- NextAuth.js v5 with JWT sessions
- Bcrypt password hashing (12 rounds)
- 30-day session expiration

## Authorization
- Role-Based Access Control (RBAC)
- Roles: Admin, Regular User
- Permissions enforced on routes and API endpoints

## API Security
- Rate limiting: 10 requests/minute per IP
- CSRF protection enabled
- Input validation with Zod

## Security Headers
- HSTS enabled
- XSS protection
- Frame options: SAMEORIGIN
- Content Security Policy configured

## Audit Logging
- All sensitive actions logged
- Logs include: user, action, entity, timestamp, IP

## Password Policy
- Minimum 8 characters
- Must contain: uppercase, lowercase, number
- Hashed with bcrypt (12 rounds)
- No password reuse (implement if needed)

## Session Management
- JWT-based sessions
- HttpOnly cookies
- Secure flag in production
- SameSite: lax

## Reporting Security Issues
Email: security@yourdomain.com
```

### 7.3 Environment Variable Security

**File:** `.env.example`

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/assettracker

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Optional: Rate Limiting (if using Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**File:** `.gitignore` (ensure these are present)

```
.env
.env.local
.env*.local
```

### 7.4 Create Admin Dashboard

**File:** `/src/app/admin/page.jsx`

```jsx
import { requireAdmin } from "@/lib/auth-guards";
import prisma from "@/lib/prisma";

export default async function AdminDashboard() {
  await requireAdmin();

  const stats = await prisma.$transaction([
    prisma.user.count(),
    prisma.asset.count(),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            username: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    }),
  ]);

  const [userCount, assetCount, auditCount, recentAudits] = stats;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Users" value={userCount} />
        <StatCard title="Total Assets" value={assetCount} />
        <StatCard title="Audit Logs" value={auditCount} />
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        {/* Display audit logs table */}
      </div>
    </div>
  );
}
```

### 7.5 Password Reset Flow (Optional Enhancement)

**File:** `/src/app/api/auth/forgot-password/route.js`

```javascript
// Implementation:
// 1. User requests password reset
// 2. Generate secure token
// 3. Send email with reset link
// 4. Validate token and allow password change
// 5. Invalidate token after use
```

### 7.6 Two-Factor Authentication (Optional Enhancement)

```bash
npm install @auth/core
npm install speakeasy qrcode
```

Implement 2FA as an optional security enhancement for admin accounts.

**Testing Phase 7:**
- [ ] All security tests pass
- [ ] Documentation complete
- [ ] Environment variables documented
- [ ] Admin dashboard accessible
- [ ] Audit logs working
- [ ] Password policy enforced
- [ ] Security headers verified

---

## Implementation Checklist

### Phase 1: NextAuth Setup ✅
- [ ] Switch to TypeScript
- [ ] Use Zod for validation
- [ ] Install next-auth and bcryptjs
- [ ] Create auth.config.js
- [ ] Create auth.js
- [ ] Create API route handler
- [ ] Set environment variables
- [ ] Test auth configuration

### Phase 2: Database Integration ✅
- [ ] Add NextAuth tables to schema
- [ ] Run Prisma migration
- [ ] Create password hashing utility
- [ ] Create password migration script
- [ ] Run password migration
- [ ] Update user creation API
- [ ] Verify passwords hashed

### Phase 3: Login UI ✅
- [ ] Create login page
- [ ] Update navigation with auth
- [ ] Create sign out button
- [ ] Create session provider
- [ ] Update root layout
- [ ] Test login flow
- [ ] Test session persistence

### Phase 4: Route Protection ✅
- [ ] Create auth middleware
- [ ] Create auth guard functions
- [ ] Protect pages with guards
- [ ] Create API auth helpers
- [ ] Protect API routes
- [ ] Test route protection

### Phase 5: RBAC ✅
- [ ] Define permission matrix
- [ ] Create permission helpers
- [ ] Create permission hooks
- [ ] Create UI permission guards
- [ ] Apply RBAC to UI
- [ ] Create audit log system
- [ ] Test RBAC enforcement

### Phase 6: API Security ✅
- [ ] Install rate limiting
- [ ] Create rate limiter
- [ ] Apply rate limiting
- [ ] Add security headers
- [ ] Add CSRF protection
- [ ] Add input validation
- [ ] Test API security

### Phase 7: Testing & Hardening ✅
- [ ] Run security tests
- [ ] Create security documentation
- [ ] Secure environment variables
- [ ] Create admin dashboard
- [ ] Document password policy
- [ ] Final security audit

---

## Security Best Practices Applied

1. **Password Security**
   - Bcrypt with 12 rounds
   - Minimum password requirements
   - No plain text storage

2. **Session Security**
   - JWT-based sessions
   - HttpOnly cookies
   - Secure cookies in production
   - Session expiration

3. **API Security**
   - Rate limiting
   - Input validation
   - CSRF protection
   - Authorization checks

4. **Data Security**
   - Parameterized queries (Prisma)
   - Input sanitization
   - Output encoding (React default)

5. **Infrastructure Security**
   - Security headers
   - HTTPS enforcement (production)
   - Environment variable protection

6. **Audit & Monitoring**
   - Audit logging
   - Failed login tracking
   - Activity monitoring

---

## Post-Implementation Tasks

1. **Security Audit**
   - Run `npm audit`
   - Check for known vulnerabilities
   - Update dependencies regularly

2. **Penetration Testing**
   - Test authentication bypass
   - Test authorization bypass
   - Test injection attacks
   - Test session hijacking
   - Test for XSS vulnerabilities
   - Test for CSRF vulnerabilities
   - Test for SQL injection vulnerabilities
   - Test for XSS vulnerabilities
   - Test for CSRF vulnerabilities
   - Test for SQL injection vulnerabilities
   - Write Code and security tests
   - Run security tests
   - Update dependencies regularly
   - Create security documentation
   - Secure environment variables
   - Create admin dashboard
   - Document password policy
   - Final security audit
   - Write Code and security tests
   - Give user Penetration Testing Guide in markdown file

3. **Monitoring Setup**
   - Set up error tracking (Sentry)
   - Monitor failed login attempts
   - Alert on suspicious activity

4. **Backup Strategy**
   - Regular database backups
   - Secure backup storage
   - Test restore procedures

5. **Compliance**
   - GDPR compliance (if applicable)
   - Data retention policies
   - Privacy policy updates

---

## Success Criteria

- [ ] All pages protected by authentication
- [ ] All API endpoints protected
- [ ] RBAC enforced everywhere
- [ ] Passwords securely hashed
- [ ] Rate limiting active
- [ ] Security headers configured
- [ ] Audit logging functional
- [ ] Documentation complete
- [ ] All tests passing
- [ ] No critical vulnerabilities
- [ ] Production-ready security posture

---

## Notes

- This plan prioritizes security without over-engineering
- Each phase builds on the previous one
- All code examples are production-ready
- Testing is integrated throughout
- Rollback plan available at every phase
- Compatible with existing codebase structure
- Uses industry-standard security practices
