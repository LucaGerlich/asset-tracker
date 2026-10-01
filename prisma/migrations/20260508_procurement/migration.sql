-- Procurement workflow tables

CREATE TABLE "public"."purchase_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "requesterId" UUID NOT NULL,
  "departmentId" UUID,
  "organizationId" UUID NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
  "estimatedTotal" DECIMAL(12,2),
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(6),
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("userid") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."user"("userid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "purchase_requests_organizationId_idx" ON "public"."purchase_requests"("organizationId");
CREATE INDEX "purchase_requests_status_idx" ON "public"."purchase_requests"("status");
CREATE INDEX "purchase_requests_requesterId_idx" ON "public"."purchase_requests"("requesterId");

CREATE TABLE "public"."purchase_request_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchaseRequestId" UUID NOT NULL,
  "entityType" VARCHAR(30) NOT NULL DEFAULT 'other',
  "description" VARCHAR(500) NOT NULL,
  "quantity" INT NOT NULL DEFAULT 1,
  "estimatedUnitCost" DECIMAL(10,2),
  "supplierId" UUID,
  "receivedQuantity" INT NOT NULL DEFAULT 0,
  "notes" TEXT,

  CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_request_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "public"."purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."supplier"("supplierid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "purchase_request_items_purchaseRequestId_idx" ON "public"."purchase_request_items"("purchaseRequestId");

CREATE TABLE "public"."purchase_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchaseRequestId" UUID,
  "poNumber" VARCHAR(50) NOT NULL,
  "supplierId" UUID,
  "organizationId" UUID NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "totalAmount" DECIMAL(12,2),
  "sentAt" TIMESTAMP(6),
  "expectedDeliveryDate" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_poNumber_key" UNIQUE ("poNumber"),
  CONSTRAINT "purchase_orders_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "public"."purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."supplier"("supplierid") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "purchase_orders_organizationId_idx" ON "public"."purchase_orders"("organizationId");
CREATE INDEX "purchase_orders_status_idx" ON "public"."purchase_orders"("status");
CREATE INDEX "purchase_orders_purchaseRequestId_idx" ON "public"."purchase_orders"("purchaseRequestId");

CREATE TABLE "public"."goods_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchaseOrderId" UUID NOT NULL,
  "receivedBy" UUID NOT NULL,
  "receivedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]',

  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "goods_receipts_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "public"."user"("userid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "public"."goods_receipts"("purchaseOrderId");
