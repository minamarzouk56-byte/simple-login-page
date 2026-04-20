-- Restrict listing of avatars bucket: only owner can list their own folder.
-- Public read remains via direct public URL (storage layer), but listing is gated.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

CREATE POLICY "avatars_owner_list" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin(auth.uid())
    )
  );