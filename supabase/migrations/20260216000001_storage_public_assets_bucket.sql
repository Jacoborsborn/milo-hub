-- Create public-assets bucket for PT logos (create in Dashboard if this fails)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/svg+xml', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own pt-logos/{user_id}/ folder
CREATE POLICY "pt_logos_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'public-assets'
  AND (storage.foldername(name))[1] = 'pt-logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "pt_logos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'public-assets'
  AND (storage.foldername(name))[1] = 'pt-logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Public read for public-assets (public URLs)
CREATE POLICY "public_assets_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'public-assets');
