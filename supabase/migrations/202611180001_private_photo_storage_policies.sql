BEGIN;

-- Canonical paths are owner/property/task-or-incident/file. Older paths are
-- accepted only when an accessible database record actually references them.
CREATE OR REPLACE FUNCTION public.tenant_can_access_photo_object(p_bucket text, p_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND (
        (p_bucket = 'cleaning-photos' AND EXISTS (
            SELECT 1
            FROM public.cleaning_tasks AS task
            JOIN public.properties AS property ON property.id::text = task.property_id::text
            WHERE public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
              AND (
                  (split_part(p_path, '/', 1) = property.user_id::text
                   AND split_part(p_path, '/', 2) = property.id::text
                   AND split_part(p_path, '/', 3) = task.id::text
                   AND split_part(p_path, '/', 4) <> ''
                   AND array_length(string_to_array(p_path, '/'), 1) = 4)
                  OR EXISTS (
                      SELECT 1 FROM public.cleaning_task_photos AS photo
                      WHERE photo.task_id::text = task.id::text
                        AND photo.property_id::text = property.id::text
                        AND photo.storage_path = p_path
                        AND split_part(p_path, '/', 1) = photo.uploaded_by::text
                  )
                  OR (
                      split_part(p_path, '/', 1) IN (
                          property.user_id::text,
                          (SELECT member.auth_user_id::text FROM public.team_members AS member
                           WHERE member.id::text = task.assigned_team_member_id::text
                             AND member.owner_id::text = property.user_id::text)
                      )
                      AND EXISTS (
                          SELECT 1 FROM unnest(ARRAY[
                              to_jsonb(task)->>'photo_before_url', to_jsonb(task)->>'photo_after_url'
                          ]) AS photo(url)
                          WHERE photo.url = p_path OR right(photo.url, length('/storage/v1/object/public/cleaning-photos/' || p_path))
                              = '/storage/v1/object/public/cleaning-photos/' || p_path
                      )
                  )
              )
        ))
        OR (p_bucket = 'property-incidents' AND EXISTS (
            SELECT 1 FROM public.properties AS property
            WHERE property.id::text = split_part(p_path, '/', 2)
              AND public.tenant_can_read_property(property.id::text)
              AND split_part(p_path, '/', 1) = property.user_id::text
              AND split_part(p_path, '/', 3) <> ''
              AND split_part(p_path, '/', 4) <> ''
              AND array_length(string_to_array(p_path, '/'), 1) = 4
        ))
        OR (p_bucket IN ('cleaning-photos', 'property-incidents') AND EXISTS (
            SELECT 1 FROM public.property_incidents AS incident
            WHERE public.tenant_can_read_property(incident.property_id::text)
              AND split_part(p_path, '/', 1) = incident.created_by::text
              AND EXISTS (
                  SELECT 1 FROM unnest(coalesce(incident.photos, ARRAY[]::text[]) || ARRAY[incident.photo_url]) AS photo(url)
                  WHERE photo.url = p_path OR right(photo.url, length('/storage/v1/object/public/' || p_bucket || '/' || p_path))
                      = '/storage/v1/object/public/' || p_bucket || '/' || p_path
              )
        ))
    );
$$;
REVOKE ALL ON FUNCTION public.tenant_can_access_photo_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_access_photo_object(text, text) TO anon, authenticated;

UPDATE storage.buckets SET public = false WHERE id IN ('cleaning-photos', 'property-incidents');

DROP POLICY IF EXISTS tenant_photo_storage_read ON storage.objects;
DROP POLICY IF EXISTS tenant_photo_storage_select ON storage.objects;
DROP POLICY IF EXISTS tenant_photo_storage_isolation ON storage.objects;
DROP POLICY IF EXISTS tenant_photo_storage_insert ON storage.objects;
DROP POLICY IF EXISTS tenant_photo_storage_update ON storage.objects;
DROP POLICY IF EXISTS tenant_photo_storage_delete ON storage.objects;

-- Restrictive isolation also constrains any older permissive Storage policies.
CREATE POLICY tenant_photo_storage_isolation ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (bucket_id NOT IN ('cleaning-photos', 'property-incidents')
           OR public.tenant_can_access_photo_object(bucket_id, name))
    WITH CHECK (bucket_id NOT IN ('cleaning-photos', 'property-incidents')
                OR public.tenant_can_access_photo_object(bucket_id, name));

CREATE POLICY tenant_photo_storage_select ON storage.objects FOR SELECT TO authenticated
    USING (public.tenant_can_access_photo_object(bucket_id, name));
CREATE POLICY tenant_photo_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (public.tenant_can_access_photo_object(bucket_id, name));
CREATE POLICY tenant_photo_storage_update ON storage.objects FOR UPDATE TO authenticated
    USING (public.tenant_can_access_photo_object(bucket_id, name))
    WITH CHECK (public.tenant_can_access_photo_object(bucket_id, name));
CREATE POLICY tenant_photo_storage_delete ON storage.objects FOR DELETE TO authenticated
    USING (public.tenant_can_access_photo_object(bucket_id, name));

NOTIFY pgrst, 'reload schema';
COMMIT;
