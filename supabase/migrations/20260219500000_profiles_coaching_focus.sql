-- Add coaching_focus to profiles (used by signup/verify-otp and profile settings)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coaching_focus text;
