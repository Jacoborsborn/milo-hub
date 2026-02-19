-- Billing: cancel_effective_at for UI; cancellation_feedback for cancel reason

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_effective_at timestamptz;

-- Cancellation feedback when user starts cancel flow (reason + optional details)
CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_pt_user_id ON public.cancellation_feedback(pt_user_id);

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancellation_feedback_insert_own" ON public.cancellation_feedback;
CREATE POLICY "cancellation_feedback_insert_own" ON public.cancellation_feedback
  FOR INSERT WITH CHECK (auth.uid() = pt_user_id);

DROP POLICY IF EXISTS "cancellation_feedback_select_own" ON public.cancellation_feedback;
CREATE POLICY "cancellation_feedback_select_own" ON public.cancellation_feedback
  FOR SELECT USING (auth.uid() = pt_user_id);
