-- Ensure public.profiles has email (from auth.users, not metadata).
-- Trigger: on auth.users INSERT, upsert public.profiles with id and email.
-- Function runs as SECURITY DEFINER with row_security off so RLS does not block the insert.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$;

-- Trigger already exists from 20260217000000 / 20260219600000; ensure it uses the new function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Verification (run manually after migration):
-- Last 10 profiles with email populated, and that email matches auth.users.
--
--   SELECT p.id, p.email AS profile_email, u.email AS auth_email,
--          (p.email IS NOT DISTINCT FROM u.email) AS match
--   FROM public.profiles p
--   JOIN auth.users u ON u.id = p.id
--   WHERE p.email IS NOT NULL
--   ORDER BY p.id DESC
--   LIMIT 10;
-- ---------------------------------------------------------------------------
