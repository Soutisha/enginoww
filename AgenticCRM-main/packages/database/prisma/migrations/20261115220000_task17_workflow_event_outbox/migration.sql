CREATE TABLE "WorkflowEventOutbox" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityId" TEXT,
  "contactId" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowEventOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowEventOutbox_status_availableAt_idx" ON "WorkflowEventOutbox"("status", "availableAt");
CREATE INDEX "WorkflowEventOutbox_companyId_createdAt_idx" ON "WorkflowEventOutbox"("companyId", "createdAt");
