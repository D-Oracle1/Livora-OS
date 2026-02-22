-- CreateTable: RBAC Roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "roles"("name");

-- AlterTable: Add roleId to staff_profiles
ALTER TABLE "staff_profiles" ADD COLUMN "roleId" TEXT;

-- CreateIndex
CREATE INDEX "staff_profiles_roleId_idx" ON "staff_profiles"("roleId");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
