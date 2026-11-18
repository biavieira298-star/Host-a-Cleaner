BEGIN;

-- Dono do alojamento, cleaner atribuído ao alojamento ou a uma tarefa desse alojamento.
CREATE OR REPLACE FUNCTION public.tenant_can_read_property(p_property_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.properties AS property
        WHERE property.id::text = p_property_id
          AND (
              property.user_id::text = auth.uid()::text
              OR EXISTS (
                  SELECT 1 FROM public.team_members AS member
                  JOIN public.profiles AS profile ON profile.id::text = member.auth_user_id::text
                  WHERE member.owner_id::text = property.user_id::text
                    AND member.auth_user_id::text = auth.uid()::text
                    AND member.role = 'cleaner'
                    AND profile.role::text = 'cleaner'
                    AND coalesce(profile.subscription_plan::text, '') <> 'admin'
                    AND (
                        member.id::text = property.assigned_team_member_id::text
                        OR EXISTS (
                            SELECT 1 FROM public.cleaning_tasks AS task
                            WHERE task.property_id::text = property.id::text
                              AND task.assigned_team_member_id::text = member.id::text
                        )
                    )
              )
          )
    );
$$;
REVOKE ALL ON FUNCTION public.tenant_can_read_property(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_read_property(text) TO anon, authenticated;

-- Dono do alojamento, ou o autor do registo (cleaner) enquanto mantiver acesso.
CREATE OR REPLACE FUNCTION public.tenant_can_manage_property_record(p_property_id text, p_author_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.properties AS property
            WHERE property.id::text = p_property_id
              AND property.user_id::text = auth.uid()::text
        )
        OR (p_author_id = auth.uid()::text AND public.tenant_can_read_property(p_property_id))
    );
$$;
REVOKE ALL ON FUNCTION public.tenant_can_manage_property_record(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_manage_property_record(text, text) TO anon, authenticated;

-- property_incidents
DROP POLICY IF EXISTS property_incidents_select_owner_or_creator ON public.property_incidents;
DROP POLICY IF EXISTS property_incidents_insert_assigned_or_owner ON public.property_incidents;
DROP POLICY IF EXISTS property_incidents_resolve_manager ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_owner_update ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_select ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_write_insert ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_write_update ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_write_delete ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_read ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_insert ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_update ON public.property_incidents;
DROP POLICY IF EXISTS tenant_incidents_delete ON public.property_incidents;

ALTER TABLE public.property_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_incidents_select ON public.property_incidents FOR SELECT TO authenticated
    USING (public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_write_insert ON public.property_incidents FOR INSERT TO authenticated
    WITH CHECK (created_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_write_update ON public.property_incidents FOR UPDATE TO authenticated
    USING (public.tenant_can_manage_property_record(property_id::text, created_by::text))
    WITH CHECK (public.tenant_can_manage_property_record(property_id::text, created_by::text));
CREATE POLICY tenant_incidents_write_delete ON public.property_incidents FOR DELETE TO authenticated
    USING (public.tenant_can_manage_property_record(property_id::text, created_by::text));

CREATE POLICY tenant_incidents_read ON public.property_incidents AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_insert ON public.property_incidents AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (created_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_update ON public.property_incidents AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (public.tenant_can_manage_property_record(property_id::text, created_by::text))
    WITH CHECK (public.tenant_can_manage_property_record(property_id::text, created_by::text));
CREATE POLICY tenant_incidents_delete ON public.property_incidents AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (public.tenant_can_manage_property_record(property_id::text, created_by::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_incidents TO authenticated;

-- cleaning_task_photos: o dono pode também alterar/apagar fotografias dos cleaners.
DROP POLICY IF EXISTS tenant_photos_update ON public.cleaning_task_photos;
DROP POLICY IF EXISTS tenant_photos_delete ON public.cleaning_task_photos;
DROP POLICY IF EXISTS tenant_photos_write_update ON public.cleaning_task_photos;
DROP POLICY IF EXISTS tenant_photos_write_delete ON public.cleaning_task_photos;

CREATE POLICY tenant_photos_write_update ON public.cleaning_task_photos FOR UPDATE TO authenticated
    USING (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text))
    WITH CHECK (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text));
CREATE POLICY tenant_photos_write_delete ON public.cleaning_task_photos FOR DELETE TO authenticated
    USING (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text));
CREATE POLICY tenant_photos_update ON public.cleaning_task_photos AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text))
    WITH CHECK (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text));
CREATE POLICY tenant_photos_delete ON public.cleaning_task_photos AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (public.tenant_can_manage_property_record(property_id::text, uploaded_by::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_task_photos TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
