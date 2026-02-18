-- Add review workflow columns to public.plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_ready_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL;

-- Index for Review Plans list: filter by pt_user_id + review_status, order by review_ready_at desc
CREATE INDEX IF NOT EXISTS idx_plans_review_queue
  ON public.plans (pt_user_id, review_status, review_ready_at DESC NULLS LAST);
