-- Combined automation: one row per client with independent meal/workout toggles
-- program_type 'combined', program_id null, auto_meals_enabled, auto_workouts_enabled

-- Allow program_type 'combined' and make program_id nullable
ALTER TABLE public.program_assignments
  DROP CONSTRAINT IF EXISTS program_assignments_program_type_check;

ALTER TABLE public.program_assignments
  ADD CONSTRAINT program_assignments_program_type_check
  CHECK (program_type IN ('workout', 'meal', 'combined'));

ALTER TABLE public.program_assignments
  ALTER COLUMN program_id DROP NOT NULL;

-- Independent toggles for combined rows (defaults: meals ON, workouts OFF)
ALTER TABLE public.program_assignments
  ADD COLUMN IF NOT EXISTS auto_meals_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_workouts_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.program_assignments.auto_meals_enabled IS 'When true (and combined), autogen creates meal drafts.';
COMMENT ON COLUMN public.program_assignments.auto_workouts_enabled IS 'When true (and combined), autogen creates workout drafts.';

-- Plans: allow one workout AND one meal per (assignment, week)
DROP INDEX IF EXISTS public.idx_plans_assignment_week_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_assignment_week_plan_type_unique
  ON public.plans (assignment_id, week_number, plan_type)
  WHERE assignment_id IS NOT NULL AND week_number IS NOT NULL;
