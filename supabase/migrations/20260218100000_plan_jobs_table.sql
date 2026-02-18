-- Generation Center job queue: plan_jobs (used by /api/jobs and Generation Center)
CREATE TABLE IF NOT EXISTS public.plan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('meal', 'workout', 'both')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}',
  result_plan_ids jsonb NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional FK to clients if the table exists and has id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'plan_jobs_client_id_fkey' AND table_name = 'plan_jobs'
    ) THEN
      ALTER TABLE public.plan_jobs
        ADD CONSTRAINT plan_jobs_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_jobs_pt_user_status_created
  ON public.plan_jobs (pt_user_id, status, created_at DESC);

-- Ensure updated_at exists for existing tables
ALTER TABLE public.plan_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON TABLE public.plan_jobs IS 'Generation Center jobs: workout/meal plan generation queue per PT user';
