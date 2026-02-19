-- Automation: template FKs, generate-on day-of-week, active flag
-- workout_template_id -> pt_templates (workout), meal_template_id -> pt_meal_templates (meal)

ALTER TABLE public.program_assignments
  ADD COLUMN IF NOT EXISTS workout_template_id uuid REFERENCES public.pt_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meal_template_id uuid REFERENCES public.pt_meal_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generate_on_dow integer NOT NULL DEFAULT 6 CHECK (generate_on_dow >= 0 AND generate_on_dow <= 6),
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.program_assignments.generate_on_dow IS '0=Sunday, 1=Monday, ..., 6=Saturday. Day of week to run autogen.';
COMMENT ON COLUMN public.program_assignments.active IS 'When false, assignment is excluded from autogen (soft off).';

-- RLS: existing policies allow SELECT/INSERT/UPDATE/DELETE where pt_user_id = auth.uid();
-- New columns are included; no policy change needed.
