-- CreateEnum (safe: skip if already exists)
DO $$ BEGIN
  CREATE TYPE "AwardType" AS ENUM ('STAFF_OF_MONTH', 'REALTOR_OF_MONTH', 'CLIENT_OF_MONTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "monthly_awards" (
    "id" TEXT NOT NULL,
    "type" "AwardType" NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_awards_userId_idx" ON "monthly_awards"("userId");

-- CreateIndex
CREATE INDEX "monthly_awards_type_idx" ON "monthly_awards"("type");

-- CreateIndex
CREATE INDEX "monthly_awards_isPublished_idx" ON "monthly_awards"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_awards_type_month_year_key" ON "monthly_awards"("type", "month", "year");

-- AddForeignKey
ALTER TABLE "monthly_awards" ADD CONSTRAINT "monthly_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
