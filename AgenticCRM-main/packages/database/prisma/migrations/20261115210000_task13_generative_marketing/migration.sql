CREATE TABLE "MarketingBrandProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandName" TEXT,
    "tagline" TEXT,
    "voice" TEXT NOT NULL DEFAULT 'clear, helpful and confident',
    "audience" TEXT,
    "valueProps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "preferredTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "avoidTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "ctaStyle" TEXT NOT NULL DEFAULT 'clear and action-oriented',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingBrandProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "platform" TEXT,
    "title" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingBrandProfile_companyId_key" ON "MarketingBrandProfile"("companyId");
CREATE INDEX "MarketingAsset_companyId_type_createdAt_idx" ON "MarketingAsset"("companyId", "type", "createdAt");
CREATE INDEX "MarketingAsset_companyId_status_idx" ON "MarketingAsset"("companyId", "status");
ALTER TABLE "MarketingBrandProfile" ADD CONSTRAINT "MarketingBrandProfile_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
