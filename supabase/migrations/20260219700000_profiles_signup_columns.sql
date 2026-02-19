-- Ensure signup/verify-otp profile columns exist (fixes "Could not find 'full_name' column" / schema cache)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coaching_focus text;
