-- program_assignments: one row per client-program with start date and auto-gen settings
CREATE TABLE IF NOT EXISTS public.program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  program_type text NOT NULL CHECK (program_type IN ('workout', 'meal')),
  program_id uuid NOT NULL,
  start_date date NOT NULL,
  auto_generate_enabled boolean NOT NULL DEFAULT false,
  autogen_lead_days integer NOT NULL DEFAULT 2 CHECK (autogen_lead_days >= 0 AND autogen_lead_days <= 6),
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_assignments_pt_user
  ON public.program_assignments (pt_user_id);
CREATE INDEX IF NOT EXISTS idx_program_assignments_autogen
  ON public.program_assignments (pt_user_id, auto_generate_enabled, paused)
  WHERE auto_generate_enabled = true AND paused = false;

ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_assignments_select_own" ON public.program_assignments;
CREATE POLICY "program_assignments_select_own" ON public.program_assignments
  FOR SELECT USING (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "program_assignments_insert_own" ON public.program_assignments;
CREATE POLICY "program_assignments_insert_own" ON public.program_assignments
  FOR INSERT WITH CHECK (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "program_assignments_update_own" ON public.program_assignments;
CREATE POLICY "program_assignments_update_own" ON public.program_assignments
  FOR UPDATE USING (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "program_assignments_delete_own" ON public.program_assignments;
CREATE POLICY "program_assignments_delete_own" ON public.program_assignments
  FOR DELETE USING (pt_user_id = auth.uid());

-- Plans: add columns for assignment-based weekly drafts (nullable for existing rows)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.program_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS week_number integer;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent'));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS generated_by text NOT NULL DEFAULT 'manual' CHECK (generated_by IN ('manual', 'auto'));
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS source_hash text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS needs_regen boolean NOT NULL DEFAULT false;

-- Backfill status for existing rows: mark already-sent plans as status = 'sent'
UPDATE public.plans
SET status = 'sent'
WHERE review_status = 'sent';

-- Unique constraint: one plan per (assignment, week) when assignment is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_assignment_week_unique
  ON public.plans (assignment_id, week_number)
  WHERE assignment_id IS NOT NULL AND week_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_assignment_week
  ON public.plans (assignment_id, week_number)
  WHERE assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_autogen_drafts
  ON public.plans (pt_user_id, status, generated_by)
  WHERE status = 'draft' AND generated_by = 'auto';
