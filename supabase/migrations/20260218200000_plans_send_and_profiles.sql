-- Review & Send: plan tracking and client email, profile branding

-- Clients: ensure email column exists
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;

-- Plans: ensure send-tracking columns exist
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS last_sent_to text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS last_sent_subject text;

-- Profiles: ensure branding columns exist (display_name, brand_logo_url may already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_logo_url text;
