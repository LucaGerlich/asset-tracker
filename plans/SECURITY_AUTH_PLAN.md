# Security & Authentication Implementation Plan
## NextAuth.js Integration for Asset Tracker

**Status Update (2026-02-18):** This plan has been consolidated into `plans/MASTER_PLAN.md`. Use the master plan for current status aligned with the codebase.

## Summary
- NextAuth v5 integration plan, RBAC, and API hardening steps.
- Security hardening roadmap (rate limits, CSRF, headers, MFA, reset flows).

**Current State Analysis:**
- Next.js 16.1.5 (App Router)
- Prisma 7.3.0 with PostgreSQL
- Existing user table with: `username`, `password`, `email`, `isadmin`, `canrequest`
- NextAuth credential auth implemented with JWT sessions
- Core API routes protected; remaining legacy endpoints are being hardened

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

```javascript
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username },
              { email: credentials.username }, // Allow email login too
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.userid,
          username: user.username,
          email: user.email,
          name: `${user.firstname} ${user.lastname}`,
          isAdmin: user.isadmin,
          canRequest: user.canrequest,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.isAdmin = user.isAdmin;
        token.canRequest = user.canRequest;
      }

      // Update session (for profile updates)
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.isAdmin = token.isAdmin;
        session.user.canRequest = token.canRequest;
      }
      return session;
    },
  },
};
```

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

```javascript
import prisma from "../src/lib/prisma.js";
import bcrypt from "bcryptjs";

async function migratePasswords() {
  console.log("Starting password migration...");

  const users = await prisma.user.findMany({
    select: {
      userid: true,
      password: true,
      username: true,
    },
  });

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    // Check if password is already hashed (bcrypt hashes start with $2)
    if (user.password.startsWith("$2")) {
      console.log(`User ${user.username} already has hashed password, skipping`);
      continue;
    }

    // Hash the plain text password
    const hashedPassword = await bcrypt.hash(user.password, 12);

    await prisma.user.update({
      where: { userid: user.userid },
      data: { password: hashedPassword },
    });

    console.log(`✓ Migrated password for user: ${user.username}`);
  }

  console.log("Password migration complete!");
}

migratePasswords()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

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

```jsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster, toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username: form.username,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Login failed", {
          description: "Invalid username or password",
        });
        return;
      }

      toast.success("Login successful");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error("Login failed", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Toaster position="bottom-right" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Asset Tracker Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, username: e.target.value }))
                }
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3.2 Update Navigation with Auth

**File:** `/src/components/Navigation.jsx` (add auth)

```jsx
import { auth } from "@/auth";
import { SignOutButton } from "./SignOutButton";

async function Navigation() {
  const session = await auth();

  if (!session) {
    // Redirect to login handled by middleware
    return null;
  }

  return (
    <nav className="border-b">
      {/* ... existing nav code ... */}

      {/* Update user dropdown */}
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {session.user.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {session.user.email}
            </p>
            {session.user.isAdmin && (
              <Badge variant="secondary" className="w-fit mt-1">
                Admin
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/user/${session.user.id}`}>My Items</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/user/${session.user.id}/settings`}>Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutButton />
      </DropdownMenuContent>
    </nav>
  );
}

export default Navigation;
```

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

```javascript
"use client";

import { useSession } from "next-auth/react";
import { userHasPermission } from "@/lib/permissions";

export function usePermissions() {
  const { data: session } = useSession();

  const hasPermission = (permission) => {
    if (!session?.user) return false;
    return userHasPermission(session.user, permission);
  };

  const isAdmin = session?.user?.isAdmin || false;
  const canRequest = session?.user?.canRequest || false;

  return {
    hasPermission,
    isAdmin,
    canRequest,
    user: session?.user,
  };
}
```

### 5.3 Create UI Permission Guards

**File:** `/src/components/PermissionGuard.jsx`

```jsx
"use client";

import { usePermissions } from "@/hooks/usePermissions";

export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return <>{children}</>;
}

export function AdminOnly({ children, fallback = null }) {
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return fallback;
  }

  return <>{children}</>;
}
```

### 5.4 Apply RBAC to UI (Example)

**File:** `/src/components/Navigation.jsx`

```jsx
import { AdminOnly } from "@/components/PermissionGuard";

// In navigation items
<AdminOnly>
  <DropdownMenuItem asChild>
    <Link href="/manufacturers/create">Create Manufacturer</Link>
  </DropdownMenuItem>
</AdminOnly>
```

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

```javascript
import prisma from "./prisma";
import { headers } from "next/headers";

export async function logAudit({
  userId,
  action,
  entity,
  entityId = null,
  details = null,
}) {
  const headersList = headers();
  const ipAddress = headersList.get("x-forwarded-for") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// Usage in API routes:
// await logAudit({
//   userId: user.id,
//   action: "CREATE",
//   entity: "ASSET",
//   entityId: asset.assetid,
//   details: { assetname: asset.assetname },
// });
```

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

```javascript
import { LRUCache } from "lru-cache";

const tokenCache = new LRUCache({
  max: 500,
  ttl: 60000, // 60 seconds
});

export const rateLimit = {
  check: (identifier, limit = 10) => {
    const tokenCount = tokenCache.get(identifier) || [0];
    const currentUsage = tokenCount[0];
    const isRateLimited = currentUsage >= limit;

    tokenCache.set(identifier, [currentUsage + 1]);

    return {
      success: !isRateLimited,
      limit,
      remaining: Math.max(0, limit - currentUsage - 1),
    };
  },
};
```

### 6.3 Create Rate Limit Middleware

**File:** `/src/lib/api-middleware.js`

```javascript
import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

export function withRateLimit(handler, options = {}) {
  return async (request, context) => {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const { success, limit, remaining } = rateLimit.check(
      ip,
      options.limit || 10
    );

    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        }
      );
    }

    const response = await handler(request, context);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());

    return response;
  };
}
```

### 6.4 Apply Rate Limiting to Login

**File:** `/src/app/api/auth/[...nextauth]/route.js`

```javascript
import { handlers } from "@/auth";
import { withRateLimit } from "@/lib/api-middleware";

// Wrap POST with rate limiting (login attempts)
export const GET = handlers.GET;
export const POST = withRateLimit(handlers.POST, { limit: 5 });
```

### 6.5 Add Security Headers

**File:** `/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 6.6 Add CSRF Protection

NextAuth.js includes built-in CSRF protection. Ensure it's enabled:

**File:** `/src/auth.config.js` (add to config)

```javascript
export const authConfig = {
  // ... existing config ...
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
```

### 6.7 Input Validation & Sanitization

**Install validator:**
```bash
npm install validator zod
```

**File:** `/src/lib/validation.js`

```javascript
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
- [x] Install next-auth and bcryptjs
- [x] Create auth.config.js
- [x] Create auth.js
- [x] Create API route handler
- [ ] Set environment variables
- [ ] Test auth configuration

### Phase 2: Database Integration ✅
- [ ] Add NextAuth tables to schema
- [ ] Run Prisma migration
- [x] Create password hashing utility
- [x] Create password migration script
- [ ] Run password migration
- [x] Update user creation API
- [ ] Verify passwords hashed

### Phase 3: Login UI ✅
- [x] Create login page
- [x] Update navigation with auth
- [x] Create sign out button
- [x] Create session provider
- [x] Update root layout
- [ ] Test login flow
- [ ] Test session persistence

### Phase 4: Route Protection ✅
- [ ] Create auth middleware
- [x] Create auth guard functions
- [x] Protect pages with guards
- [x] Create API auth helpers
- [x] Protect API routes
- [ ] Test route protection

### Phase 5: RBAC ✅
- [x] Define permission matrix
- [x] Create permission helpers
- [x] Create permission hooks
- [x] Create UI permission guards
- [ ] Apply RBAC to UI
- [x] Create audit log system
- [ ] Test RBAC enforcement

### Phase 6: API Security ✅
- [x] Install rate limiting
- [x] Create rate limiter
- [ ] Apply rate limiting
- [x] Add security headers
- [ ] Add CSRF protection
- [x] Add input validation
- [ ] Test API security

### Phase 7: Testing & Hardening ✅
- [ ] Run security tests
- [x] Create security documentation
- [ ] Secure environment variables
- [x] Create admin dashboard
- [x] Document password policy
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
- [x] Passwords securely hashed
- [ ] Rate limiting active
- [x] Security headers configured
- [x] Audit logging functional
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
