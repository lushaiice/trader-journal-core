-- Make trade-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'trade-screenshots';

-- Add owner-only SELECT policy (first folder segment must equal auth.uid())
DROP POLICY IF EXISTS "Users can read their own trade screenshots" ON storage.objects;
CREATE POLICY "Users can read their own trade screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);