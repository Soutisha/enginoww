CREATE TABLE "LeadScoringModel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "weights" JSONB NOT NULL,
    "bias" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "featureNames" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "trainingSamples" INTEGER NOT NULL,
    "positiveSamples" INTEGER NOT NULL,
    "negativeSamples" INTEGER NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadScoringModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadScoringModel_companyId_key" ON "LeadScoringModel"("companyId");
CREATE INDEX "LeadScoringModel_trainedAt_idx" ON "LeadScoringModel"("trainedAt");
ALTER TABLE "LeadScoringModel"
  ADD CONSTRAINT "LeadScoringModel_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
