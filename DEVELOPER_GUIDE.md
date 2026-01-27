# NextAuth.js Authentication - Developer Quick Start

Quick reference guide for developers working with the authentication system.

## Authentication Flow

```
1. User visits protected page
   ↓
2. Middleware checks session
   ↓
3. No session? → Redirect to /login
   ↓
4. User submits credentials
   ↓
5. NextAuth validates credentials
   ↓
6. Create JWT token
   ↓
7. Set session cookie
   ↓
8. Redirect to requested page
```

## Quick API Reference

### Server-Side (Pages/API Routes)

```javascript
import { auth } from "@/auth";
import { requireAuth, requireAdmin } from "@/lib/auth-guards";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";

// Get session in a server component
export default async function Page() {
  const session = await auth();
  
  if (!session) {
    // User not logged in
  }
  
  if (session.user.isAdmin) {
    // User is admin
  }
}

// Require authentication
export default async function ProtectedPage() {
  const session = await requireAuth(); // Redirects if not authenticated
  return <div>Welcome {session.user.name}</div>;
}

// Require admin role
export default async function AdminPage() {
  const session = await requireAdmin(); // Redirects if not admin
  return <div>Admin Dashboard</div>;
}

// API Route - Require authentication
export async function GET() {
  try {
    const user = await requireApiAuth();
    // User is authenticated
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// API Route - Require admin
export async function POST() {
  try {
    const admin = await requireApiAdmin();
    // User is authenticated admin
  } catch (error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
```

### Client-Side (React Components)

```javascript
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGuard, AdminGuard } from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === "loading") {
    return <div>Loading...</div>;
  }
  
  if (!session) {
    return <button onClick={() => signIn()}>Sign In</button>;
  }
  
  return (
    <div>
      <p>Welcome {session.user.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

// Using permission hooks
function ProtectedButton() {
  const { hasPermission, isAdmin } = usePermissions();
  
  if (isAdmin()) {
    return <button>Admin Action</button>;
  }
  
  if (hasPermission(PERMISSIONS.ASSET_CREATE)) {
    return <button>Create Asset</button>;
  }
  
  return null;
}

// Using permission guards
function ConditionalContent() {
  return (
    <>
      <AdminGuard>
        <div>Only admins see this</div>
      </AdminGuard>
      
      <PermissionGuard permission={PERMISSIONS.ASSET_EDIT}>
        <button>Edit Asset</button>
      </PermissionGuard>
    </>
  );
}
```

## Session Object Structure

```typescript
{
  user: {
    id: string,           // User UUID
    name: string,         // "Firstname Lastname"
    email: string | null,
    username: string,
    isAdmin: boolean,
    canRequest: boolean,
    firstname: string,
    lastname: string
  },
  expires: string         // ISO date string
}
```

## Common Patterns

### Protect a Page

```javascript
// src/app/protected-page/page.jsx
import { requireAuth } from "@/lib/auth-guards";

export default async function ProtectedPage() {
  await requireAuth(); // Redirects to login if not authenticated
  
  return <div>Protected Content</div>;
}
```

### Protect an Admin Page

```javascript
// src/app/admin/page.jsx
import { requireAdmin } from "@/lib/auth-guards";

export default async function AdminPage() {
  await requireAdmin(); // Redirects to home if not admin
  
  return <div>Admin Dashboard</div>;
}
```

### Protect an API Route

```javascript
// src/app/api/resource/route.js
import { requireApiAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireApiAuth();
    
    // Fetch data
    const data = await fetchUserData(user.id);
    
    return NextResponse.json(data);
  } catch (error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

### Validate Input

```javascript
import { createAssetSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();
  
  // Validate input
  const result = createAssetSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { 
        error: "Validation failed", 
        details: result.error.errors 
      },
      { status: 400 }
    );
  }
  
  // Use validated data
  const validatedData = result.data;
  // ...
}
```

### Create Audit Log

```javascript
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// After creating/updating/deleting a resource
await createAuditLog({
  userId: user.id,
  action: AUDIT_ACTIONS.CREATE,
  entity: AUDIT_ENTITIES.ASSET,
  entityId: createdAsset.id,
  details: {
    assetname: createdAsset.assetname,
    assettag: createdAsset.assettag,
  },
});
```

### Hash a Password

```javascript
import { hashPassword } from "@/lib/auth-utils";

const hashedPassword = await hashPassword(plainTextPassword);

// Save hashedPassword to database
await prisma.user.create({
  data: {
    password: hashedPassword,
    // ... other fields
  },
});
```

## Available Permissions

```javascript
import { PERMISSIONS } from "@/lib/permissions";

PERMISSIONS.ASSET_VIEW
PERMISSIONS.ASSET_CREATE
PERMISSIONS.ASSET_EDIT
PERMISSIONS.ASSET_DELETE
PERMISSIONS.ASSET_ASSIGN

PERMISSIONS.USER_VIEW
PERMISSIONS.USER_CREATE
PERMISSIONS.USER_EDIT
PERMISSIONS.USER_DELETE

PERMISSIONS.ACCESSORY_VIEW
PERMISSIONS.ACCESSORY_CREATE
PERMISSIONS.ACCESSORY_EDIT
PERMISSIONS.ACCESSORY_DELETE
PERMISSIONS.ACCESSORY_REQUEST

PERMISSIONS.LICENSE_VIEW
PERMISSIONS.LICENSE_CREATE
PERMISSIONS.LICENSE_EDIT
PERMISSIONS.LICENSE_DELETE

PERMISSIONS.SETTINGS_VIEW
PERMISSIONS.SETTINGS_EDIT

PERMISSIONS.CATALOG_MANAGE
```

## Audit Actions

```javascript
import { AUDIT_ACTIONS } from "@/lib/audit-log";

AUDIT_ACTIONS.CREATE
AUDIT_ACTIONS.UPDATE
AUDIT_ACTIONS.DELETE
AUDIT_ACTIONS.LOGIN
AUDIT_ACTIONS.LOGOUT
AUDIT_ACTIONS.LOGIN_FAILED
AUDIT_ACTIONS.PASSWORD_CHANGE
AUDIT_ACTIONS.ASSIGN
AUDIT_ACTIONS.UNASSIGN
AUDIT_ACTIONS.REQUEST
AUDIT_ACTIONS.APPROVE
AUDIT_ACTIONS.REJECT
```

## Common Tasks

### Add a New Protected Route

1. Create your page component
2. Add auth guard:
```javascript
import { requireAuth } from "@/lib/auth-guards";

export default async function MyPage() {
  await requireAuth();
  // Your page content
}
```

### Add a New API Endpoint

1. Create route file
2. Add authentication:
```javascript
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(request) {
  try {
    const user = await requireApiAuth();
    // Your logic
  } catch (error) {
    // Handle auth errors
  }
}
```

### Add Input Validation

1. Define schema in `src/lib/validation.js`:
```javascript
export const mySchema = z.object({
  field1: z.string().min(1),
  field2: z.number().positive(),
});
```

2. Use in API route:
```javascript
import { mySchema } from "@/lib/validation";

const result = mySchema.safeParse(body);
if (!result.success) {
  return NextResponse.json(
    { error: "Validation failed", details: result.error.errors },
    { status: 400 }
  );
}
```

### Check User Permissions

```javascript
import { userHasPermission, PERMISSIONS } from "@/lib/permissions";

if (userHasPermission(user, PERMISSIONS.ASSET_EDIT)) {
  // User can edit assets
}
```

### Get Current User Info

```javascript
// Server component
import { auth } from "@/auth";

const session = await auth();
console.log(session.user.id);
console.log(session.user.name);
console.log(session.user.isAdmin);

// Client component
import { useSession } from "next-auth/react";

const { data: session } = useSession();
console.log(session?.user.id);
```

## Testing

### Test Login Locally

```bash
# Start dev server
npm run dev

# Navigate to login page
open http://localhost:3000/login

# Use credentials from database
# Check browser DevTools for session cookie
```

### Test API Authentication

```bash
# Without auth (should fail)
curl http://localhost:3000/api/manufacturer
# Response: {"error":"Unauthorized"}

# Get session cookie from browser
# Use it in request
curl http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
# Response: [...manufacturers...]
```

## Debugging

### Enable Debug Logging

```javascript
// src/auth.config.js
export const authConfig = {
  // ... other config
  debug: process.env.NODE_ENV === "development",
};
```

### Check Session

```javascript
// In any server component
import { auth } from "@/auth";

const session = await auth();
console.log("Session:", JSON.stringify(session, null, 2));
```

### View Audit Logs

```sql
-- Recent activity
SELECT 
  al.*, 
  u.username 
FROM audit_logs al
LEFT JOIN "user" u ON al."userId" = u.userid
ORDER BY al."createdAt" DESC
LIMIT 20;

-- Failed logins
SELECT * FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY "createdAt" DESC;
```

## Best Practices

1. **Always use auth guards** for protected pages
2. **Always validate input** with Zod schemas
3. **Never store passwords** in plain text
4. **Always create audit logs** for sensitive operations
5. **Check permissions** before showing UI elements
6. **Handle auth errors** gracefully
7. **Use HTTPS** in production
8. **Rotate secrets** regularly
9. **Keep dependencies** updated
10. **Review audit logs** regularly

## Common Errors

### "Cannot find module '@/auth'"
- Check jsconfig.json path aliases
- Ensure file exists at src/auth.js

### "Unauthorized" on API call
- User not logged in
- Session expired
- Check middleware configuration

### "Forbidden" on API call
- User lacks required permission
- Check user role in database

### Login redirects to login
- Check NEXTAUTH_SECRET is set
- Verify password was hashed correctly
- Check browser console for errors

## Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Zod Documentation](https://zod.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- SECURITY.md - Security documentation
- PENETRATION_TESTING.md - Testing guide
- DEPLOYMENT_GUIDE.md - Deployment instructions

---

For more details, see the full documentation in SECURITY.md
