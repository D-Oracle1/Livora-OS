-- Add allowedModules array to departments
-- Empty array = no restriction (all sidebar items visible)
-- Non-empty = only listed module keys are shown in the sidebar
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "allowedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
