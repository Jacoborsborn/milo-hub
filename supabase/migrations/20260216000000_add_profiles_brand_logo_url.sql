-- Add PT branding logo URL to profiles (nullable; default = use Milo logo)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS brand_logo_url text NULL;

COMMENT ON COLUMN profiles.brand_logo_url IS 'PT custom logo URL (Supabase Storage or external). When null, app uses default Milo logo.';
