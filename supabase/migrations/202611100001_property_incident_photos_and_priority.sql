ALTER TABLE public.property_incidents
    ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.property_incidents
    DROP CONSTRAINT IF EXISTS property_incidents_priority_check,
    ADD CONSTRAINT property_incidents_priority_check
        CHECK (priority IN ('urgent', 'normal', 'low'));

ALTER TABLE public.property_incidents
    DROP CONSTRAINT IF EXISTS property_incidents_type_check,
    ADD CONSTRAINT property_incidents_type_check
        CHECK (type IN ('note', 'incident', 'damage', 'forgotten_item'));

UPDATE public.property_incidents
SET photos = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND coalesce(cardinality(photos), 0) = 0;

UPDATE public.property_incidents
SET priority = 'urgent'
WHERE is_priority = true;

CREATE INDEX IF NOT EXISTS property_incidents_priority_created_at_idx
    ON public.property_incidents (priority, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'property-incidents',
    'property-incidents',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS property_incidents_photos_upload ON storage.objects;
CREATE POLICY property_incidents_photos_upload
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'property-incidents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.auth_user_id = auth.uid()
                        AND member.role = 'cleaner'
                        AND member.id = property.assigned_team_member_id
                  )
              )
        )
    );

DROP POLICY IF EXISTS property_incidents_photos_select ON storage.objects;
CREATE POLICY property_incidents_photos_select
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'property-incidents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.auth_user_id = auth.uid()
                        AND member.role = 'cleaner'
                        AND member.id = property.assigned_team_member_id
                  )
              )
        )
    );

DROP POLICY IF EXISTS property_incidents_photos_update ON storage.objects;
CREATE POLICY property_incidents_photos_update
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'property-incidents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'property-incidents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.auth_user_id = auth.uid()
                        AND member.role = 'cleaner'
                        AND member.id = property.assigned_team_member_id
                  )
              )
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.property_incidents TO authenticated;
