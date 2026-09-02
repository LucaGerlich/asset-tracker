-- CreateTable
CREATE TABLE "public"."status_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fromStatusId" UUID NOT NULL,
    "toStatusId" UUID NOT NULL,
    "requiredRole" VARCHAR(50),
    "notifyOnTransition" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "status_transitions_fromStatusId_toStatusId_key" ON "public"."status_transitions"("fromStatusId", "toStatusId");

-- AddForeignKey
ALTER TABLE "public"."status_transitions" ADD CONSTRAINT "status_transitions_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "public"."statusType"("statustypeid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."status_transitions" ADD CONSTRAINT "status_transitions_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "public"."statusType"("statustypeid") ON DELETE CASCADE ON UPDATE CASCADE;
