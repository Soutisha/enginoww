CREATE TABLE "CallRecord" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT,
  "leadId" TEXT,
  "phoneNumber" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "provider" TEXT,
  "externalId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "transcript" TEXT,
  "summary" TEXT,
  "intent" TEXT,
  "outcome" TEXT,
  "recordingUrl" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallRecord_companyId_provider_externalId_key" ON "CallRecord"("companyId", "provider", "externalId");
CREATE INDEX "CallRecord_companyId_startedAt_idx" ON "CallRecord"("companyId", "startedAt");
CREATE INDEX "CallRecord_companyId_contactId_idx" ON "CallRecord"("companyId", "contactId");
CREATE INDEX "CallRecord_companyId_leadId_idx" ON "CallRecord"("companyId", "leadId");
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
