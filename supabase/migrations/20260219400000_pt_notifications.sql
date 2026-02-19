-- PT in-app notifications (e.g. autogen draft ready)
CREATE TABLE IF NOT EXISTS public.pt_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link_path text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_notifications_pt_user_unread_created
  ON public.pt_notifications (pt_user_id, is_read, created_at DESC);

ALTER TABLE public.pt_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_notifications_select_own" ON public.pt_notifications;
CREATE POLICY "pt_notifications_select_own" ON public.pt_notifications
  FOR SELECT USING (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "pt_notifications_update_own" ON public.pt_notifications;
CREATE POLICY "pt_notifications_update_own" ON public.pt_notifications
  FOR UPDATE USING (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "pt_notifications_delete_own" ON public.pt_notifications;
CREATE POLICY "pt_notifications_delete_own" ON public.pt_notifications
  FOR DELETE USING (pt_user_id = auth.uid());

DROP POLICY IF EXISTS "pt_notifications_insert_own" ON public.pt_notifications;
CREATE POLICY "pt_notifications_insert_own" ON public.pt_notifications
  FOR INSERT WITH CHECK (pt_user_id = auth.uid());

-- Service role (e.g. cron Edge Function) bypasses RLS and can insert for any pt_user_id.
