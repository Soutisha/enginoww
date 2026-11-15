CREATE TABLE "MultiAgentRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "agents" JSONB NOT NULL,
  "sharedContext" JSONB NOT NULL DEFAULT '{}',
  "taskResults" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approvalRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MultiAgentRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MultiAgentRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MultiAgentRun_companyId_createdAt_idx" ON "MultiAgentRun"("companyId", "createdAt");
CREATE INDEX "MultiAgentRun_companyId_status_idx" ON "MultiAgentRun"("companyId", "status");
