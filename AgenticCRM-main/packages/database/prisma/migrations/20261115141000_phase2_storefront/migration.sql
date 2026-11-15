ALTER TABLE "Company" ADD COLUMN "storefrontEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "storefrontDescription" TEXT;
ALTER TABLE "Company" ADD COLUMN "storefrontBannerUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN "storefrontAccentColor" TEXT NOT NULL DEFAULT '#4f46e5';
