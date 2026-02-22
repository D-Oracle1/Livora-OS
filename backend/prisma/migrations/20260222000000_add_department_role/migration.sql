-- Add role field to departments table
-- Staff created in a department will inherit this role
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'STAFF';
