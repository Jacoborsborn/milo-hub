-- Fix "Database error saving new user": the trigger that creates a profile row runs
-- under RLS, but profiles has no INSERT policy. Disable RLS for the trigger's insert only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
