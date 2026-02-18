# Future Enhancements Implementation Plan

**Status Update (2026-02-18):** This plan has been consolidated into `plans/MASTER_PLAN.md`. Use the master plan for current status aligned with the codebase.

## Summary
- Long-term roadmap for multi-tenancy, integrations, compliance, and UX improvements.
- Detailed implementation steps for schema and API additions.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the Asset Tracker with multi-tenancy, advanced integrations, compliance features, and improved UX across 8 major feature areas.

**Architecture:** Incremental feature additions leveraging existing Next.js/Prisma architecture. Each enhancement builds on current patterns (NextAuth, Zod validation, API routes, Prisma models). Priority on backward compatibility and database migrations.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, NextAuth v5, TypeScript, Zod, TailwindCSS, Radix UI

---

## Phase 1: Multi-tenancy & Organization (Foundation)

### Task 1.1: Database Schema - Organizations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_organizations.sql`

**Step 1: Add Organization model to schema**

Add to `prisma/schema.prisma`:

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  settings    Json?    // Organization-specific settings
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  isActive    Boolean  @default(true)

  // Relationships
  users       User[]
  departments Department[]
  assets      asset[]
  accessories accessories[]
  licences    licence[]
  consumables consumable[]

  @@map("organizations")
}

model Department {
  id             String       @id @default(cuid())
  name           String
  description    String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  parentId       String?
  parent         Department?  @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children       Department[] @relation("DepartmentHierarchy")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  // Relationships
  users          User[]

  @@map("departments")
}
```

**Step 2: Update User model with organization references**

Add to User model in `prisma/schema.prisma`:

```prisma
model user {
  // ... existing fields
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  departmentId   String?
  department     Department?   @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  // ... rest of model
}
```

**Step 3: Update all entity models with organizationId**

For models: asset, accessories, licence, consumable, add:

```prisma
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
```

**Step 4: Create migration**

Run:
```bash
npx prisma migrate dev --name add_organizations
```

Expected: Migration created successfully, database updated

**Step 5: Update seed scripts**

Modify: `prisma/demo-seed.js`

Add organization creation:

```javascript
// Create default organization
const defaultOrg = await prisma.organization.create({
  data: {
    name: "Default Organization",
    slug: "default",
    description: "Default organization for existing data",
    isActive: true
  }
});

// Update all existing users, assets, etc. with organizationId
await prisma.user.updateMany({
  data: { organizationId: defaultOrg.id }
});
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/demo-seed.js
git commit -m "feat: add multi-tenancy organization and department models"
```

---

### Task 1.2: Organization CRUD API

**Files:**
- Create: `src/app/api/organizations/route.ts`
- Create: `src/app/api/organizations/[id]/route.ts`
- Create: `src/app/api/departments/route.ts`
- Create: `src/app/api/departments/[id]/route.ts`
- Create: `src/lib/validation-organization.ts`

**Step 1: Write organization validation schemas**

Create `src/lib/validation-organization.ts`:

```typescript
import { z } from 'zod';

export const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().default(true)
});

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  organizationId: z.string().cuid(),
  parentId: z.string().cuid().optional()
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
```

**Step 2: Create organization API routes**

Create `src/app/api/organizations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { organizationSchema } from '@/lib/validation-organization';
import { createAuditLog } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, assets: true, departments: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = organizationSchema.parse(body);

    const organization = await prisma.organization.create({
      data: validated
    });

    await createAuditLog(
      session.user.id,
      'CREATE',
      'Organization',
      organization.id,
      req.headers.get('x-forwarded-for') || req.ip,
      req.headers.get('user-agent')
    );

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
```

Create `src/app/api/organizations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { organizationSchema } from '@/lib/validation-organization';
import { createAuditLog } from '@/lib/audit-log';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      include: {
        departments: true,
        _count: {
          select: { users: true, assets: true, accessories: true, licences: true }
        }
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = organizationSchema.partial().parse(body);

    const organization = await prisma.organization.update({
      where: { id: params.id },
      data: validated
    });

    await createAuditLog(
      session.user.id,
      'UPDATE',
      'Organization',
      organization.id,
      req.headers.get('x-forwarded-for') || req.ip,
      req.headers.get('user-agent')
    );

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.organization.delete({
      where: { id: params.id }
    });

    await createAuditLog(
      session.user.id,
      'DELETE',
      'Organization',
      params.id,
      req.headers.get('x-forwarded-for') || req.ip,
      req.headers.get('user-agent')
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
```

**Step 3: Create department API routes**

Create `src/app/api/departments/route.ts` (similar pattern to organizations)

**Step 4: Test API endpoints**

Run development server:
```bash
npm run dev
```

Test with curl:
```bash
# Create organization
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","slug":"test-org","description":"Test organization"}'

# List organizations
curl http://localhost:3000/api/organizations
```

Expected: 201 Created, organization returned

**Step 5: Commit**

```bash
git add src/app/api/organizations src/app/api/departments src/lib/validation-organization.ts
git commit -m "feat: add organization and department CRUD APIs"
```

---

### Task 1.3: Enhanced RBAC System

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_rbac.sql`
- Modify: `src/lib/permissions.ts`
- Create: `src/lib/rbac.ts`

**Step 1: Add Role and Permission models**

Add to `prisma/schema.prisma`:

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String
  description String?
  permissions String[] // Array of permission strings
  isSystem    Boolean  @default(false) // System roles can't be deleted
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       UserRole[]

  @@unique([name, organizationId])
  @@map("roles")
}

model UserRole {
  id        String   @id @default(cuid())
  userId    String
  user      user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  grantedAt DateTime @default(now())
  grantedBy String?

  @@unique([userId, roleId])
  @@map("user_roles")
}
```

**Step 2: Update User model**

Add to user model:

```prisma
model user {
  // ... existing fields
  roles UserRole[]
  // ... rest of model
}
```

**Step 3: Create RBAC helper library**

Create `src/lib/rbac.ts`:

```typescript
import { prisma } from './prisma';

export const PERMISSIONS = {
  // Assets
  'asset:view': 'View assets',
  'asset:create': 'Create assets',
  'asset:edit': 'Edit assets',
  'asset:delete': 'Delete assets',
  'asset:assign': 'Assign assets to users',

  // Users
  'user:view': 'View users',
  'user:create': 'Create users',
  'user:edit': 'Edit users',
  'user:delete': 'Delete users',

  // Accessories
  'accessory:view': 'View accessories',
  'accessory:create': 'Create accessories',
  'accessory:edit': 'Edit accessories',
  'accessory:delete': 'Delete accessories',

  // Licenses
  'license:view': 'View licenses',
  'license:create': 'Create licenses',
  'license:edit': 'Edit licenses',
  'license:delete': 'Delete licenses',
  'license:assign': 'Assign licenses',

  // Consumables
  'consumable:view': 'View consumables',
  'consumable:create': 'Create consumables',
  'consumable:edit': 'Edit consumables',
  'consumable:delete': 'Delete consumables',

  // Organizations & Departments
  'org:view': 'View organizations',
  'org:manage': 'Manage organizations',
  'dept:view': 'View departments',
  'dept:manage': 'Manage departments',

  // Settings
  'settings:view': 'View settings',
  'settings:edit': 'Edit settings',

  // Reports
  'report:view': 'View reports',
  'report:export': 'Export reports',

  // Audit logs
  'audit:view': 'View audit logs'
} as const;

export type Permission = keyof typeof PERMISSIONS;

export async function getUserPermissions(userId: string): Promise<Set<Permission>> {
  const userWithRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!userWithRoles) {
    return new Set();
  }

  // Admin users get all permissions
  if (userWithRoles.isadmin) {
    return new Set(Object.keys(PERMISSIONS) as Permission[]);
  }

  const permissions = new Set<Permission>();

  userWithRoles.roles.forEach(userRole => {
    userRole.role.permissions.forEach(perm => {
      permissions.add(perm as Permission);
    });
  });

  return permissions;
}

export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.has(permission);
}

export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return permissions.some(perm => userPermissions.has(perm));
}

export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return permissions.every(perm => userPermissions.has(perm));
}

// Middleware helper
export function createPermissionGuard(requiredPermissions: Permission[]) {
  return async (userId: string) => {
    return await hasAllPermissions(userId, requiredPermissions);
  };
}
```

**Step 4: Create migration**

```bash
npx prisma migrate dev --name add_rbac_system
```

Expected: Migration successful

**Step 5: Create seed data for default roles**

Add to `prisma/demo-seed.js`:

```javascript
// Create default roles
const adminRole = await prisma.role.create({
  data: {
    name: 'Administrator',
    description: 'Full system access',
    isSystem: true,
    permissions: Object.keys(PERMISSIONS)
  }
});

const userRole = await prisma.role.create({
  data: {
    name: 'Standard User',
    description: 'View-only access',
    isSystem: true,
    permissions: [
      'asset:view', 'accessory:view', 'license:view',
      'consumable:view', 'report:view'
    ]
  }
});

const managerRole = await prisma.role.create({
  data: {
    name: 'Asset Manager',
    description: 'Can manage assets and assignments',
    isSystem: true,
    permissions: [
      'asset:view', 'asset:create', 'asset:edit', 'asset:assign',
      'accessory:view', 'accessory:create', 'accessory:edit',
      'license:view', 'license:assign',
      'consumable:view', 'report:view', 'report:export'
    ]
  }
});
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/rbac.ts prisma/demo-seed.js
git commit -m "feat: add role-based access control (RBAC) system"
```

---

### Task 1.4: Organization Context Middleware

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/lib/organization-context.ts`
- Modify: `src/types/next-auth.d.ts`

**Step 1: Extend NextAuth session types**

Modify `src/types/next-auth.d.ts`:

```typescript
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      isadmin: boolean;
      canrequest: boolean;
      organizationId?: string;
      departmentId?: string;
      permissions?: string[];
    }
  }

  interface User {
    id: string;
    username: string;
    email: string;
    isadmin: boolean;
    canrequest: boolean;
    organizationId?: string;
    departmentId?: string;
  }
}
```

**Step 2: Update auth.ts to include organization in session**

Modify `src/auth.ts`:

```typescript
// In jwt callback
jwt: async ({ token, user }) => {
  if (user) {
    token.id = user.id;
    token.username = user.username;
    token.email = user.email;
    token.isadmin = user.isadmin;
    token.canrequest = user.canrequest;
    token.organizationId = user.organizationId;
    token.departmentId = user.departmentId;

    // Fetch user permissions
    const permissions = await getUserPermissions(user.id);
    token.permissions = Array.from(permissions);
  }
  return token;
},

// In session callback
session: async ({ session, token }) => {
  session.user.id = token.id as string;
  session.user.username = token.username as string;
  session.user.email = token.email as string;
  session.user.isadmin = token.isadmin as boolean;
  session.user.canrequest = token.canrequest as boolean;
  session.user.organizationId = token.organizationId as string | undefined;
  session.user.departmentId = token.departmentId as string | undefined;
  session.user.permissions = token.permissions as string[];
  return session;
}
```

**Step 3: Create organization context helper**

Create `src/lib/organization-context.ts`:

```typescript
import { auth } from '@/auth';
import { prisma } from './prisma';

export async function getOrganizationContext() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      departments: true
    }
  });

  return {
    organization,
    userId: session.user.id,
    departmentId: session.user.departmentId,
    isAdmin: session.user.isadmin,
    permissions: new Set(session.user.permissions || [])
  };
}

// Helper to scope queries to user's organization
export function scopeToOrganization<T extends { organizationId?: string }>(
  baseWhere: any,
  organizationId?: string | null
) {
  if (!organizationId) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    organizationId
  };
}
```

**Step 4: Test organization context**

Test with:
```bash
npm run dev
```

Login and verify session includes organizationId.

**Step 5: Commit**

```bash
git add src/middleware.ts src/lib/organization-context.ts src/types/next-auth.d.ts src/auth.ts
git commit -m "feat: add organization context to session and middleware"
```

---

## Phase 2: Integration & APIs

### Task 2.1: REST API Documentation (OpenAPI/Swagger)

**Files:**
- Create: `src/app/api/docs/route.ts`
- Create: `public/openapi.json`
- Create: `src/lib/swagger-config.ts`

**Step 1: Install Swagger dependencies**

```bash
npm install swagger-ui-react swagger-jsdoc
npm install -D @types/swagger-ui-react
```

Expected: Dependencies installed

**Step 2: Create OpenAPI specification**

Create `public/openapi.json`:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Asset Tracker API",
    "version": "1.0.0",
    "description": "Asset management system API documentation",
    "contact": {
      "name": "API Support"
    }
  },
  "servers": [
    {
      "url": "http://localhost:3000/api",
      "description": "Development server"
    }
  ],
  "components": {
    "securitySchemes": {
      "cookieAuth": {
        "type": "apiKey",
        "in": "cookie",
        "name": "next-auth.session-token"
      }
    },
    "schemas": {
      "Asset": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "tag": { "type": "string" },
          "serialnumber": { "type": "string" },
          "purchaseprice": { "type": "number" },
          "purchasedate": { "type": "string", "format": "date" },
          "modelid": { "type": "string" },
          "categoryid": { "type": "string" },
          "statusid": { "type": "string" },
          "organizationId": { "type": "string" }
        }
      },
      "Organization": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "slug": { "type": "string" },
          "description": { "type": "string" },
          "isActive": { "type": "boolean" }
        }
      },
      "Error": {
        "type": "object",
        "properties": {
          "error": { "type": "string" },
          "status": { "type": "integer" }
        }
      }
    }
  },
  "paths": {
    "/asset": {
      "get": {
        "summary": "List all assets",
        "security": [{ "cookieAuth": [] }],
        "responses": {
          "200": {
            "description": "List of assets",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/Asset" }
                }
              }
            }
          }
        }
      },
      "post": {
        "summary": "Create a new asset",
        "security": [{ "cookieAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/Asset" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Asset created",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Asset" }
              }
            }
          }
        }
      }
    },
    "/organizations": {
      "get": {
        "summary": "List all organizations",
        "security": [{ "cookieAuth": [] }],
        "responses": {
          "200": {
            "description": "List of organizations",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/Organization" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Step 3: Create Swagger UI page**

Create `src/app/api/docs/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const openApiPath = path.join(process.cwd(), 'public', 'openapi.json');
  const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));

  return NextResponse.json(openApiSpec);
}
```

Create `src/app/api-docs/page.tsx`:

```typescript
'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">API Documentation</h1>
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
```

**Step 4: Test API documentation**

Run:
```bash
npm run dev
```

Navigate to: http://localhost:3000/api-docs

Expected: Swagger UI displays with API endpoints

**Step 5: Commit**

```bash
git add public/openapi.json src/app/api/docs src/app/api-docs package.json
git commit -m "feat: add OpenAPI/Swagger API documentation"
```

---

### Task 2.2: Webhook System

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_webhooks.sql`
- Create: `src/lib/webhooks.ts`
- Create: `src/app/api/webhooks/route.ts`
- Create: `src/app/api/webhooks/[id]/route.ts`

**Step 1: Add Webhook models**

Add to `prisma/schema.prisma`:

```prisma
model Webhook {
  id             String   @id @default(cuid())
  name           String
  url            String
  secret         String?  // For signature verification
  events         String[] // Array of event types to trigger on
  isActive       Boolean  @default(true)
  retryAttempts  Int      @default(3)
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  deliveries     WebhookDelivery[]

  @@map("webhooks")
}

model WebhookDelivery {
  id           String   @id @default(cuid())
  webhookId    String
  webhook      Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  event        String   // Event type that triggered
  payload      Json     // Event data
  statusCode   Int?     // HTTP response code
  response     String?  // Response body
  attempt      Int      @default(1)
  success      Boolean  @default(false)
  deliveredAt  DateTime @default(now())
  error        String?

  @@map("webhook_deliveries")
  @@index([webhookId])
}
```

**Step 2: Create migration**

```bash
npx prisma migrate dev --name add_webhook_system
```

Expected: Migration successful

**Step 3: Create webhook service**

Create `src/lib/webhooks.ts`:

```typescript
import { prisma } from './prisma';
import crypto from 'crypto';

export const WEBHOOK_EVENTS = {
  'asset.created': 'Asset created',
  'asset.updated': 'Asset updated',
  'asset.deleted': 'Asset deleted',
  'asset.assigned': 'Asset assigned to user',
  'asset.unassigned': 'Asset unassigned from user',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'license.assigned': 'License assigned',
  'license.expiring': 'License expiring soon',
  'consumable.low_stock': 'Consumable stock low',
  'maintenance.due': 'Maintenance due',
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  organizationId?: string;
}

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export async function triggerWebhook(
  event: WebhookEvent,
  data: any,
  organizationId?: string
) {
  try {
    // Find active webhooks subscribed to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event
        },
        OR: [
          { organizationId },
          { organizationId: null } // Global webhooks
        ]
      }
    });

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      organizationId
    };

    // Trigger webhooks in parallel
    const deliveries = webhooks.map(webhook =>
      deliverWebhook(webhook, payload)
    );

    await Promise.allSettled(deliveries);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

async function deliverWebhook(
  webhook: { id: string; url: string; secret: string | null; retryAttempts: number },
  payload: WebhookPayload,
  attempt = 1
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp
  };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = generateSignature(payloadString, webhook.secret);
  }

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString
    });

    const responseText = await response.text();

    // Log delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as any,
        statusCode: response.status,
        response: responseText,
        attempt,
        success: response.ok
      }
    });

    // Retry on failure
    if (!response.ok && attempt < webhook.retryAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      setTimeout(() => deliverWebhook(webhook, payload, attempt + 1), delay);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failed delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as any,
        attempt,
        success: false,
        error: errorMessage
      }
    });

    // Retry on failure
    if (attempt < webhook.retryAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      setTimeout(() => deliverWebhook(webhook, payload, attempt + 1), delay);
    }
  }
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Step 4: Create webhook CRUD API**

Create `src/app/api/webhooks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()),
  isActive: z.boolean().default(true),
  retryAttempts: z.number().min(0).max(5).default(3)
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: session.user.organizationId || null
      },
      include: {
        _count: {
          select: { deliveries: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = webhookSchema.parse(body);

    const webhook = await prisma.webhook.create({
      data: {
        ...validated,
        organizationId: session.user.organizationId
      }
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
```

**Step 5: Integrate webhook triggers into asset API**

Modify `src/app/api/asset/addAsset/route.ts`:

Add after asset creation:

```typescript
import { triggerWebhook } from '@/lib/webhooks';

// After creating asset
await triggerWebhook('asset.created', asset, session.user.organizationId);
```

**Step 6: Test webhook delivery**

Use webhook.site for testing:

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Webhook",
    "url":"https://webhook.site/your-unique-id",
    "events":["asset.created"]
  }'
```

Create an asset and verify webhook delivery.

**Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/webhooks.ts src/app/api/webhooks
git commit -m "feat: add webhook system with event triggers"
```

---

### Task 2.3: SSO/SAML Authentication

**Files:**
- Install: `next-auth-saml`
- Modify: `src/auth.config.ts`
- Create: `src/lib/saml-config.ts`
- Modify: `prisma/schema.prisma`

**Step 1: Install SAML dependencies**

```bash
npm install @boxyhq/saml-jackson
```

Expected: Package installed

**Step 2: Add SAML configuration model**

Add to `prisma/schema.prisma`:

```prisma
model SAMLProvider {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name              String   // Display name
  entryPoint        String   // IdP SSO URL
  issuer            String   // SP entity ID
  cert              String   // X.509 certificate
  signatureAlgorithm String  @default("sha256")
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([organizationId])
  @@map("saml_providers")
}
```

**Step 3: Create migration**

```bash
npx prisma migrate dev --name add_saml_provider
```

Expected: Migration successful

**Step 4: Create SAML configuration helper**

Create `src/lib/saml-config.ts`:

```typescript
import { prisma } from './prisma';
import jackson from '@boxyhq/saml-jackson';

export async function getSAMLController() {
  const { apiController, oauthController } = await jackson({
    externalUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    samlPath: '/api/auth/saml/acs',
    db: {
      engine: 'sql',
      type: 'postgres',
      url: process.env.DATABASE_URL!,
    },
  });

  return { apiController, oauthController };
}

export async function getSAMLConfig(organizationId: string) {
  const samlProvider = await prisma.sAMLProvider.findUnique({
    where: { organizationId }
  });

  if (!samlProvider || !samlProvider.isActive) {
    return null;
  }

  return {
    entryPoint: samlProvider.entryPoint,
    issuer: samlProvider.issuer,
    cert: samlProvider.cert,
    signatureAlgorithm: samlProvider.signatureAlgorithm as any
  };
}
```

**Step 5: Add SAML provider to NextAuth**

Modify `src/auth.config.ts`:

```typescript
import { getSAMLController } from '@/lib/saml-config';

// Add to providers array
providers: [
  // ... existing providers

  // SAML provider
  {
    id: 'saml',
    name: 'SAML SSO',
    type: 'oauth',
    wellKnown: `${process.env.NEXTAUTH_URL}/api/auth/saml/.well-known`,
    authorization: { params: { scope: '' } },
    idToken: true,
    checks: ['pkce', 'state'],
    profile(profile) {
      return {
        id: profile.id || profile.sub,
        email: profile.email,
        name: profile.name || profile.firstName + ' ' + profile.lastName,
      };
    },
  },
]
```

**Step 6: Create SAML API endpoints**

Create `src/app/api/auth/saml/acs/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getSAMLController } from '@/lib/saml-config';

export async function POST(req: NextRequest) {
  const { oauthController } = await getSAMLController();

  const formData = await req.formData();
  const SAMLResponse = formData.get('SAMLResponse') as string;

  const { redirect_url } = await oauthController.samlResponse({
    SAMLResponse,
  });

  return Response.redirect(redirect_url);
}
```

**Step 7: Create SAML admin UI**

Create `src/app/admin/settings/saml/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function SAMLSettingsPage() {
  const [config, setConfig] = useState({
    name: '',
    entryPoint: '',
    issuer: '',
    cert: '',
    isActive: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/admin/saml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (response.ok) {
      alert('SAML configuration saved');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">SAML SSO Configuration</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div>
          <Label htmlFor="name">Provider Name</Label>
          <Input
            id="name"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="e.g., Okta, Azure AD"
          />
        </div>

        <div>
          <Label htmlFor="entryPoint">IdP SSO URL</Label>
          <Input
            id="entryPoint"
            value={config.entryPoint}
            onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })}
            placeholder="https://idp.example.com/sso"
          />
        </div>

        <div>
          <Label htmlFor="issuer">SP Entity ID / Issuer</Label>
          <Input
            id="issuer"
            value={config.issuer}
            onChange={(e) => setConfig({ ...config, issuer: e.target.value })}
            placeholder="urn:example:sp"
          />
        </div>

        <div>
          <Label htmlFor="cert">X.509 Certificate</Label>
          <Textarea
            id="cert"
            value={config.cert}
            onChange={(e) => setConfig({ ...config, cert: e.target.value })}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            rows={8}
          />
        </div>

        <Button type="submit">Save SAML Configuration</Button>
      </form>
    </div>
  );
}
```

**Step 8: Test SAML login flow**

Configure with a test IdP (e.g., SAML-test.id), test login.

**Step 9: Commit**

```bash
git add prisma/schema.prisma src/lib/saml-config.ts src/auth.config.ts src/app/api/auth/saml src/app/admin/settings/saml
git commit -m "feat: add SAML SSO authentication support"
```

---

## Phase 3: Advanced Features

### Task 3.1: Asset Reservation/Booking System

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/reservations.ts`
- Create: `src/app/api/reservations/route.ts`

**Step 1: Add Reservation model**

Add to `prisma/schema.prisma`:

```prisma
model AssetReservation {
  id          String   @id @default(cuid())
  assetId     String
  asset       asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  userId      String
  user        user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  startDate   DateTime
  endDate     DateTime
  purpose     String?
  status      ReservationStatus @default(PENDING)
  notes       String?
  approvedBy  String?
  approver    user?    @relation("ReservationApprover", fields: [approvedBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("asset_reservations")
  @@index([assetId, startDate, endDate])
}

enum ReservationStatus {
  PENDING
  APPROVED
  REJECTED
  ACTIVE
  COMPLETED
  CANCELLED
}
```

Update asset model:

```prisma
model asset {
  // ... existing fields
  reservations AssetReservation[]
  // ... rest of model
}
```

Update user model:

```prisma
model user {
  // ... existing fields
  reservations AssetReservation[]
  approvedReservations AssetReservation[] @relation("ReservationApprover")
  // ... rest of model
}
```

**Step 2: Create migration**

```bash
npx prisma migrate dev --name add_reservation_system
```

Expected: Migration successful

**Step 3: Create reservation service**

Create `src/lib/reservations.ts`:

```typescript
import { prisma } from './prisma';
import { ReservationStatus } from '@prisma/client';

export async function checkAvailability(
  assetId: string,
  startDate: Date,
  endDate: Date,
  excludeReservationId?: string
): Promise<boolean> {
  const conflicts = await prisma.assetReservation.findMany({
    where: {
      assetId,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: {
        in: ['APPROVED', 'ACTIVE']
      },
      OR: [
        // New reservation starts during existing reservation
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: startDate } }
          ]
        },
        // New reservation ends during existing reservation
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: endDate } }
          ]
        },
        // New reservation completely contains existing reservation
        {
          AND: [
            { startDate: { gte: startDate } },
            { endDate: { lte: endDate } }
          ]
        }
      ]
    }
  });

  return conflicts.length === 0;
}

export async function createReservation(data: {
  assetId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  purpose?: string;
  notes?: string;
}) {
  // Check availability
  const isAvailable = await checkAvailability(
    data.assetId,
    data.startDate,
    data.endDate
  );

  if (!isAvailable) {
    throw new Error('Asset is not available for the requested period');
  }

  // Validate dates
  if (data.startDate >= data.endDate) {
    throw new Error('End date must be after start date');
  }

  if (data.startDate < new Date()) {
    throw new Error('Start date cannot be in the past');
  }

  return await prisma.assetReservation.create({
    data: {
      ...data,
      status: 'PENDING'
    },
    include: {
      asset: true,
      user: true
    }
  });
}

export async function approveReservation(
  reservationId: string,
  approverId: string
) {
  const reservation = await prisma.assetReservation.findUnique({
    where: { id: reservationId }
  });

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  // Re-check availability
  const isAvailable = await checkAvailability(
    reservation.assetId,
    reservation.startDate,
    reservation.endDate,
    reservationId
  );

  if (!isAvailable) {
    throw new Error('Asset is no longer available for this period');
  }

  return await prisma.assetReservation.update({
    where: { id: reservationId },
    data: {
      status: 'APPROVED',
      approvedBy: approverId
    }
  });
}

export async function getUpcomingReservations(assetId: string) {
  return await prisma.assetReservation.findMany({
    where: {
      assetId,
      status: {
        in: ['APPROVED', 'ACTIVE']
      },
      endDate: {
        gte: new Date()
      }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      }
    },
    orderBy: { startDate: 'asc' }
  });
}

// Auto-update reservation status based on dates
export async function updateReservationStatuses() {
  const now = new Date();

  // Mark as ACTIVE if start date has passed
  await prisma.assetReservation.updateMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: now },
      endDate: { gte: now }
    },
    data: { status: 'ACTIVE' }
  });

  // Mark as COMPLETED if end date has passed
  await prisma.assetReservation.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: now }
    },
    data: { status: 'COMPLETED' }
  });
}
```

**Step 4: Create reservation API**

Create `src/app/api/reservations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  createReservation,
  checkAvailability
} from '@/lib/reservations';

const reservationSchema = z.object({
  assetId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  purpose: z.string().optional(),
  notes: z.string().optional()
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get('assetId');
    const userId = searchParams.get('userId');

    const where: any = {};

    if (assetId) {
      where.assetId = assetId;
    }

    if (userId) {
      where.userId = userId;
    } else if (!session.user.isadmin) {
      // Regular users can only see their own reservations
      where.userId = session.user.id;
    }

    const reservations = await prisma.assetReservation.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            tag: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = reservationSchema.parse(body);

    const reservation = await createReservation({
      ...validated,
      userId: session.user.id,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate)
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}
```

Create `src/app/api/reservations/check-availability/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkAvailability } from '@/lib/reservations';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, startDate, endDate, excludeReservationId } = await req.json();

    const isAvailable = await checkAvailability(
      assetId,
      new Date(startDate),
      new Date(endDate),
      excludeReservationId
    );

    return NextResponse.json({ available: isAvailable });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
```

Create `src/app/api/reservations/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { approveReservation } from '@/lib/reservations';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reservation = await approveReservation(params.id, session.user.id);

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error approving reservation:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to approve reservation' }, { status: 500 });
  }
}
```

**Step 5: Create cron job for status updates**

Create `src/app/api/cron/update-reservations/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { updateReservationStatuses } from '@/lib/reservations';

export async function GET() {
  try {
    await updateReservationStatuses();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reservation statuses:', error);
    return NextResponse.json({ error: 'Failed to update statuses' }, { status: 500 });
  }
}
```

**Step 6: Test reservation flow**

```bash
# Create reservation
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "assetId":"asset-id",
    "startDate":"2026-02-01T09:00:00Z",
    "endDate":"2026-02-05T17:00:00Z",
    "purpose":"Project work"
  }'

# Check availability
curl -X POST http://localhost:3000/api/reservations/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "assetId":"asset-id",
    "startDate":"2026-02-01T09:00:00Z",
    "endDate":"2026-02-05T17:00:00Z"
  }'
```

**Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/reservations.ts src/app/api/reservations src/app/api/cron
git commit -m "feat: add asset reservation/booking system with approval workflow"
```

---

### Task 3.2: Barcode Scanning Support

**Files:**
- Install: `react-qr-scanner`, `jsbarcode`
- Create: `src/components/BarcodeScanner.tsx`
- Create: `src/components/BarcodeGenerator.tsx`
- Create: `src/app/scan/page.tsx`

**Step 1: Install barcode dependencies**

```bash
npm install jsbarcode @zxing/library
npm install -D @types/jsbarcode
```

Expected: Dependencies installed

**Step 2: Create barcode generator component**

Create `src/components/BarcodeGenerator.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export function BarcodeGenerator({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format,
          width,
          height,
          displayValue
        });
      } catch (error) {
        console.error('Barcode generation error:', error);
      }
    }
  }, [value, format, width, height, displayValue]);

  return <canvas ref={canvasRef} />;
}
```

**Step 3: Create barcode scanner component**

Create `src/components/BarcodeScanner.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onError?: (error: Error) => void;
}

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  const startScanning = async () => {
    if (!videoRef.current || !readerRef.current) return;

    try {
      setError(null);
      setIsScanning(true);

      const videoInputDevices = await readerRef.current.listVideoInputDevices();

      if (videoInputDevices.length === 0) {
        throw new Error('No camera found');
      }

      // Use the first camera (usually back camera on mobile)
      const selectedDeviceId = videoInputDevices[0].deviceId;

      await readerRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedValue = result.getText();
            onScan(scannedValue);
            stopScanning();
          }
          if (error && error.name !== 'NotFoundException') {
            console.error('Scan error:', error);
          }
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner';
      setError(errorMessage);
      if (onError && err instanceof Error) {
        onError(err);
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsScanning(false);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {!isScanning ? (
            <Button onClick={startScanning} className="w-full">
              Start Scanning
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="w-full">
              Stop Scanning
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
```

**Step 4: Create scan page**

Create `src/app/scan/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { toast } from 'sonner';

export default function ScanPage() {
  const router = useRouter();
  const [scannedValue, setScannedValue] = useState<string | null>(null);

  const handleScan = async (result: string) => {
    setScannedValue(result);
    toast.success(`Scanned: ${result}`);

    // Search for asset by tag or serial number
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(result)}`);
      const data = await response.json();

      if (data.assets && data.assets.length > 0) {
        // Navigate to first matching asset
        router.push(`/assets/${data.assets[0].id}`);
      } else {
        toast.error('No asset found with this code');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for asset');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Scan Barcode/QR Code</h1>

      <div className="max-w-md mx-auto">
        <BarcodeScanner
          onScan={handleScan}
          onError={(error) => toast.error(error.message)}
        />

        {scannedValue && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">Last scanned:</p>
            <p className="font-mono font-bold">{scannedValue}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Add barcode to asset detail page**

Modify `src/app/assets/[id]/page.tsx` to include barcode:

```typescript
import { BarcodeGenerator } from '@/components/BarcodeGenerator';

// In the component render
<div className="mt-4">
  <h3 className="text-lg font-semibold mb-2">Asset Barcode</h3>
  <BarcodeGenerator value={asset.tag} />
</div>
```

**Step 6: Test barcode scanning**

Run:
```bash
npm run dev
```

Navigate to `/scan` and test with a barcode.

**Step 7: Commit**

```bash
git add src/components/BarcodeScanner.tsx src/components/BarcodeGenerator.tsx src/app/scan package.json
git commit -m "feat: add barcode/QR code scanning and generation support"
```

---

## Phase 4: Consumables Enhancement

### Task 4.1: Inventory Tracking with Stock Alerts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/inventory.ts`
- Create: `src/app/api/consumables/checkout/route.ts`
- Create: `src/app/api/cron/check-stock-levels/route.ts`

**Step 1: Enhance Consumable model**

Modify in `prisma/schema.prisma`:

```prisma
model consumable {
  // ... existing fields
  currentQuantity Int      @default(0)
  minQuantity     Int      @default(0)
  maxQuantity     Int?
  unit            String?  // e.g., "pieces", "boxes", "liters"
  reorderPoint    Int?     // Trigger reorder when stock hits this level
  lastRestocked   DateTime?

  // Relationships
  checkouts       ConsumableCheckout[]
  stockHistory    StockHistory[]

  // ... rest of model
}

model ConsumableCheckout {
  id            String     @id @default(cuid())
  consumableId  String
  consumable    consumable @relation(fields: [consumableId], references: [id], onDelete: Cascade)
  userId        String
  user          user       @relation(fields: [userId], references: [id], onDelete: Cascade)
  quantity      Int
  notes         String?
  checkedOutAt  DateTime   @default(now())

  @@map("consumable_checkouts")
  @@index([consumableId])
  @@index([userId])
}

model StockHistory {
  id            String     @id @default(cuid())
  consumableId  String
  consumable    consumable @relation(fields: [consumableId], references: [id], onDelete: Cascade)
  changeType    StockChangeType
  quantity      Int        // Positive for additions, negative for removals
  previousQty   Int
  newQty        Int
  userId        String?
  user          user?      @relation(fields: [userId], references: [id])
  notes         String?
  createdAt     DateTime   @default(now())

  @@map("stock_history")
  @@index([consumableId])
}

enum StockChangeType {
  RESTOCK
  CHECKOUT
  ADJUSTMENT
  RETURN
  EXPIRED
}
```

Update user model:

```prisma
model user {
  // ... existing fields
  consumableCheckouts ConsumableCheckout[]
  stockChanges        StockHistory[]
  // ... rest of model
}
```

**Step 2: Create migration**

```bash
npx prisma migrate dev --name add_consumable_inventory_tracking
```

Expected: Migration successful

**Step 3: Create inventory service**

Create `src/lib/inventory.ts`:

```typescript
import { prisma } from './prisma';
import { StockChangeType } from '@prisma/client';
import { triggerWebhook } from './webhooks';
import { sendNotification } from './notifications';

export async function checkoutConsumable(
  consumableId: string,
  userId: string,
  quantity: number,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get current consumable
    const consumable = await tx.consumable.findUnique({
      where: { id: consumableId }
    });

    if (!consumable) {
      throw new Error('Consumable not found');
    }

    if (consumable.currentQuantity < quantity) {
      throw new Error('Insufficient stock available');
    }

    const previousQty = consumable.currentQuantity;
    const newQty = previousQty - quantity;

    // Create checkout record
    const checkout = await tx.consumableCheckout.create({
      data: {
        consumableId,
        userId,
        quantity,
        notes
      }
    });

    // Update consumable quantity
    await tx.consumable.update({
      where: { id: consumableId },
      data: { currentQuantity: newQty }
    });

    // Record stock history
    await tx.stockHistory.create({
      data: {
        consumableId,
        changeType: 'CHECKOUT',
        quantity: -quantity,
        previousQty,
        newQty,
        userId,
        notes
      }
    });

    // Check if low stock
    if (newQty <= consumable.minQuantity) {
      await triggerWebhook('consumable.low_stock', {
        consumable,
        currentQuantity: newQty,
        minQuantity: consumable.minQuantity
      });

      await sendNotification({
        type: 'low_stock',
        entityId: consumableId,
        entityType: 'Consumable',
        data: {
          name: consumable.name,
          currentQuantity: newQty,
          minQuantity: consumable.minQuantity
        }
      });
    }

    return checkout;
  });
}

export async function restockConsumable(
  consumableId: string,
  quantity: number,
  userId?: string,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    const consumable = await tx.consumable.findUnique({
      where: { id: consumableId }
    });

    if (!consumable) {
      throw new Error('Consumable not found');
    }

    const previousQty = consumable.currentQuantity;
    const newQty = previousQty + quantity;

    // Update consumable
    await tx.consumable.update({
      where: { id: consumableId },
      data: {
        currentQuantity: newQty,
        lastRestocked: new Date()
      }
    });

    // Record history
    await tx.stockHistory.create({
      data: {
        consumableId,
        changeType: 'RESTOCK',
        quantity,
        previousQty,
        newQty,
        userId,
        notes
      }
    });

    return { previousQty, newQty };
  });
}

export async function adjustStock(
  consumableId: string,
  newQuantity: number,
  userId: string,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    const consumable = await tx.consumable.findUnique({
      where: { id: consumableId }
    });

    if (!consumable) {
      throw new Error('Consumable not found');
    }

    const previousQty = consumable.currentQuantity;
    const change = newQuantity - previousQty;

    await tx.consumable.update({
      where: { id: consumableId },
      data: { currentQuantity: newQuantity }
    });

    await tx.stockHistory.create({
      data: {
        consumableId,
        changeType: 'ADJUSTMENT',
        quantity: change,
        previousQty,
        newQty: newQuantity,
        userId,
        notes
      }
    });

    return { previousQty, newQty: newQuantity };
  });
}

export async function getLowStockConsumables(organizationId?: string) {
  return await prisma.consumable.findMany({
    where: {
      currentQuantity: {
        lte: prisma.consumable.fields.minQuantity
      },
      organizationId
    },
    orderBy: {
      currentQuantity: 'asc'
    }
  });
}

export async function getStockHistory(consumableId: string) {
  return await prisma.stockHistory.findMany({
    where: { consumableId },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}
```

**Step 4: Create checkout API**

Create `src/app/api/consumables/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { checkoutConsumable } from '@/lib/inventory';
import { createAuditLog } from '@/lib/audit-log';

const checkoutSchema = z.object({
  consumableId: z.string().cuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = checkoutSchema.parse(body);

    const checkout = await checkoutConsumable(
      validated.consumableId,
      session.user.id,
      validated.quantity,
      validated.notes
    );

    await createAuditLog(
      session.user.id,
      'CHECKOUT',
      'Consumable',
      validated.consumableId,
      req.headers.get('x-forwarded-for') || req.ip,
      req.headers.get('user-agent')
    );

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    console.error('Error checking out consumable:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to checkout consumable' }, { status: 500 });
  }
}
```

Create `src/app/api/consumables/restock/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { restockConsumable } from '@/lib/inventory';

const restockSchema = z.object({
  consumableId: z.string().cuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = restockSchema.parse(body);

    const result = await restockConsumable(
      validated.consumableId,
      validated.quantity,
      session.user.id,
      validated.notes
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error restocking consumable:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to restock consumable' }, { status: 500 });
  }
}
```

Create `src/app/api/consumables/[id]/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStockHistory } from '@/lib/inventory';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await getStockHistory(params.id);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
```

**Step 5: Create stock level monitoring cron**

Create `src/app/api/cron/check-stock-levels/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getLowStockConsumables } from '@/lib/inventory';
import { sendNotification } from '@/lib/notifications';

export async function GET() {
  try {
    const lowStockItems = await getLowStockConsumables();

    for (const item of lowStockItems) {
      await sendNotification({
        type: 'low_stock',
        entityId: item.id,
        entityType: 'Consumable',
        data: {
          name: item.name,
          currentQuantity: item.currentQuantity,
          minQuantity: item.minQuantity
        }
      });
    }

    return NextResponse.json({
      success: true,
      itemsChecked: lowStockItems.length
    });
  } catch (error) {
    console.error('Error checking stock levels:', error);
    return NextResponse.json({ error: 'Failed to check stock levels' }, { status: 500 });
  }
}
```

**Step 6: Test inventory tracking**

```bash
# Checkout consumable
curl -X POST http://localhost:3000/api/consumables/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "consumableId":"consumable-id",
    "quantity":5,
    "notes":"For project X"
  }'

# Restock
curl -X POST http://localhost:3000/api/consumables/restock \
  -H "Content-Type: application/json" \
  -d '{
    "consumableId":"consumable-id",
    "quantity":100
  }'
```

**Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/inventory.ts src/app/api/consumables src/app/api/cron/check-stock-levels
git commit -m "feat: add consumable inventory tracking with stock alerts and checkout system"
```

---

## Phase 5: Performance & Scalability

### Task 5.1: Caching Layer Implementation

**Files:**
- Install: `@vercel/kv` or `ioredis`
- Create: `src/lib/cache.ts`
- Modify: API routes to use caching

**Step 1: Install Redis client**

```bash
npm install ioredis
npm install -D @types/ioredis
```

Expected: Dependencies installed

**Step 2: Create cache service**

Create `src/lib/cache.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }
};

// Cache key generators
export const cacheKeys = {
  asset: (id: string) => `asset:${id}`,
  assets: (orgId?: string) => `assets:${orgId || 'all'}`,
  user: (id: string) => `user:${id}`,
  organization: (id: string) => `org:${id}`,
  consumable: (id: string) => `consumable:${id}`,
  lowStock: (orgId?: string) => `low-stock:${orgId || 'all'}`
};

// Cache invalidation helpers
export async function invalidateAssetCache(assetId?: string, orgId?: string) {
  if (assetId) {
    await cache.del(cacheKeys.asset(assetId));
  }
  await cache.del(cacheKeys.assets(orgId));
}

export async function invalidateUserCache(userId: string) {
  await cache.del(cacheKeys.user(userId));
}
```

**Step 3: Add caching to asset API**

Modify `src/app/api/asset/route.ts`:

```typescript
import { cache, cacheKeys } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.user.organizationId;
    const cacheKey = cacheKeys.assets(orgId);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch from database
    const assets = await prisma.asset.findMany({
      where: scopeToOrganization({}, orgId),
      include: {
        model: true,
        category: true,
        status: true,
        supplier: true,
        location: true,
        manufacturer: true
      },
      orderBy: { createdat: 'desc' }
    });

    // Store in cache for 5 minutes
    await cache.set(cacheKey, assets, 300);

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}
```

Modify `src/app/api/asset/addAsset/route.ts`:

```typescript
import { invalidateAssetCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  // ... existing code

  // After creating asset
  await invalidateAssetCache(undefined, session.user.organizationId);

  return NextResponse.json(asset, { status: 201 });
}
```

**Step 4: Add query optimization**

Create `src/lib/query-optimization.ts`:

```typescript
import { Prisma } from '@prisma/client';

// Common select fields to reduce payload size
export const assetMinimalSelect = {
  id: true,
  name: true,
  tag: true,
  serialnumber: true,
  statusid: true,
  modelid: true,
  categoryid: true
} satisfies Prisma.assetSelect;

export const assetListSelect = {
  ...assetMinimalSelect,
  purchaseprice: true,
  purchasedate: true,
  model: {
    select: {
      id: true,
      name: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  },
  status: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.assetSelect;

// Pagination helper
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    total,
    page,
    pageSize,
    totalPages
  };
}
```

**Step 5: Add database connection pooling**

Modify `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Create connection pool
if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

const adapter = new PrismaPg(globalForPrisma.pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Step 6: Test caching**

Run:
```bash
npm run dev
```

Make multiple requests and verify cache hits in logs.

**Step 7: Commit**

```bash
git add src/lib/cache.ts src/lib/query-optimization.ts src/lib/prisma.ts src/app/api/asset package.json
git commit -m "feat: add Redis caching layer and database connection pooling"
```

---

## Phase 6: UI/UX Improvements

### Task 6.1: Bulk Import (CSV)

**Files:**
- Install: `papaparse`
- Create: `src/components/BulkImport.tsx`
- Create: `src/app/api/import/assets/route.ts`
- Create: `src/app/admin/import/page.tsx`

**Step 1: Install CSV parser**

```bash
npm install papaparse
npm install -D @types/papaparse
```

Expected: Dependencies installed

**Step 2: Create bulk import component**

Create `src/components/BulkImport.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';

interface BulkImportProps {
  entityType: 'assets' | 'users' | 'accessories' | 'consumables';
  onComplete?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function BulkImport({ entityType, onComplete }: BulkImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Send to API
            const response = await fetch(`/api/import/${entityType}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ data: results.data })
            });

            if (!response.ok) {
              throw new Error('Import failed');
            }

            const importResult = await response.json();
            setResult(importResult);

            if (importResult.failed === 0) {
              toast.success(`Successfully imported ${importResult.success} ${entityType}`);
              onComplete?.();
            } else {
              toast.warning(
                `Imported ${importResult.success} ${entityType}, ${importResult.failed} failed`
              );
            }
          } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to import data');
          } finally {
            setIsImporting(false);
          }
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          toast.error('Failed to parse CSV file');
          setIsImporting(false);
        }
      });
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data');
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templates = {
      assets: 'name,tag,serialnumber,purchaseprice,purchasedate,model,category,status,location\n' +
              'Laptop Dell XPS,LAP-001,SN123456,1200,2026-01-15,Dell XPS 13,Laptops,Available,HQ Office',
      users: 'username,email,firstname,lastname,password\n' +
             'jdoe,john@example.com,John,Doe,password123',
      accessories: 'name,tag,model,category\n' +
                   'Wireless Mouse,ACC-001,Logitech MX,Mice',
      consumables: 'name,quantity,minQuantity,category\n' +
                   'Printer Paper,500,50,Office Supplies'
    };

    const template = templates[entityType];
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_import_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Bulk Import {entityType}</h3>

      <div className="space-y-4">
        <div>
          <Button onClick={downloadTemplate} variant="outline" className="mb-2">
            Download CSV Template
          </Button>
          <p className="text-sm text-gray-600">
            Download a template file to see the required format
          </p>
        </div>

        <div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm">Selected: {file.name}</p>
            <p className="text-xs text-gray-600">Size: {(file.size / 1024).toFixed(2)} KB</p>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || isImporting}
          className="w-full"
        >
          {isImporting ? 'Importing...' : 'Import CSV'}
        </Button>

        {result && (
          <div className="mt-4 space-y-2">
            <div className="bg-green-50 p-3 rounded">
              <p className="text-sm font-semibold text-green-800">
                Successfully imported: {result.success}
              </p>
            </div>

            {result.failed > 0 && (
              <div className="bg-red-50 p-3 rounded">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  Failed to import: {result.failed}
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {result.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>
                      Row {err.row}: {err.error}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>... and {result.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
```

**Step 3: Create import API endpoint**

Create `src/app/api/import/assets/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assetSchema } from '@/lib/validation';
import { createAuditLog } from '@/lib/audit-log';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data } = await req.json();

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because of 0-index and header row

      try {
        // Find or create related entities
        let modelId = null;
        if (row.model) {
          let model = await prisma.model.findFirst({
            where: { name: row.model }
          });
          if (!model) {
            model = await prisma.model.create({
              data: { name: row.model }
            });
          }
          modelId = model.id;
        }

        let categoryId = null;
        if (row.category) {
          let category = await prisma.assetCategoryType.findFirst({
            where: { name: row.category }
          });
          if (!category) {
            category = await prisma.assetCategoryType.create({
              data: { name: row.category }
            });
          }
          categoryId = category.id;
        }

        let statusId = null;
        if (row.status) {
          let status = await prisma.statusType.findFirst({
            where: { name: row.status }
          });
          if (!status) {
            status = await prisma.statusType.create({
              data: { name: row.status }
            });
          }
          statusId = status.id;
        }

        let locationId = null;
        if (row.location) {
          let location = await prisma.location.findFirst({
            where: { name: row.location }
          });
          if (!location) {
            location = await prisma.location.create({
              data: { name: row.location }
            });
          }
          locationId = location.id;
        }

        // Create asset
        const assetData = {
          name: row.name,
          tag: row.tag,
          serialnumber: row.serialnumber || null,
          purchaseprice: row.purchaseprice ? parseFloat(row.purchaseprice) : null,
          purchasedate: row.purchasedate ? new Date(row.purchasedate) : null,
          modelid: modelId,
          categoryid: categoryId,
          statusid: statusId,
          locationid: locationId,
          organizationId: session.user.organizationId
        };

        await prisma.asset.create({ data: assetData });

        results.success++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          row: rowNumber,
          error: errorMessage
        });
      }
    }

    await createAuditLog(
      session.user.id,
      'CREATE',
      'Asset',
      'bulk-import',
      req.headers.get('x-forwarded-for') || req.ip,
      req.headers.get('user-agent')
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
```

**Step 4: Create import page**

Create `src/app/admin/import/page.tsx`:

```typescript
import { BulkImport } from '@/components/BulkImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ImportPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Bulk Import</h1>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="accessories">Accessories</TabsTrigger>
          <TabsTrigger value="consumables">Consumables</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <BulkImport entityType="assets" />
        </TabsContent>

        <TabsContent value="users">
          <BulkImport entityType="users" />
        </TabsContent>

        <TabsContent value="accessories">
          <BulkImport entityType="accessories" />
        </TabsContent>

        <TabsContent value="consumables">
          <BulkImport entityType="consumables" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 5: Test bulk import**

Run:
```bash
npm run dev
```

Navigate to `/admin/import`, download template, and test import.

**Step 6: Commit**

```bash
git add src/components/BulkImport.tsx src/app/api/import src/app/admin/import package.json
git commit -m "feat: add CSV bulk import functionality for assets and other entities"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-01-29-future-enhancements.md`.

This comprehensive plan covers:
- **Phase 1**: Multi-tenancy with organizations, departments, and enhanced RBAC
- **Phase 2**: API documentation, webhooks, and SAML SSO
- **Phase 3**: Asset reservations and barcode scanning
- **Phase 4**: Consumable inventory tracking with stock alerts
- **Phase 5**: Redis caching and performance optimization
- **Phase 6**: CSV bulk import functionality

**Remaining phases not detailed** (to keep plan focused):
- Phase 7: Compliance & Security features
- Phase 8: Additional UI/UX improvements
- Phase 9: Advanced integrations (Slack, Teams, LDAP)
- Phase 10: Customization features

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
