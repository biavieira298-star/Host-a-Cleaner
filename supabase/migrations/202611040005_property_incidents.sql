CREATE TABLE IF NOT EXISTS public.property_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('damage', 'forgotten_item')),
    description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 1000),
    photo_url text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved'))
);

ALTER TABLE public.property_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_incidents_select_owner_or_creator ON public.property_incidents;
CREATE POLICY property_incidents_select_owner_or_creator
    ON public.property_incidents FOR SELECT TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_incidents.property_id
              AND property.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS property_incidents_insert_assigned_or_owner ON public.property_incidents;
CREATE POLICY property_incidents_insert_assigned_or_owner
    ON public.property_incidents FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_incidents.property_id
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.id = property.assigned_team_member_id
                        AND member.auth_user_id = auth.uid()
                        AND member.role = 'cleaner'
                  )
              )
        )
    );

DROP POLICY IF EXISTS property_incidents_resolve_manager ON public.property_incidents;
CREATE POLICY property_incidents_resolve_manager
    ON public.property_incidents FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_incidents.property_id
              AND property.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_incidents.property_id
              AND property.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS property_incidents_status_created_at_idx
    ON public.property_incidents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS property_incidents_property_id_created_at_idx
    ON public.property_incidents (property_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.property_incidents TO authenticated;

DROP POLICY IF EXISTS cleaning_incidents_photo_delete_by_owner ON storage.objects;
CREATE POLICY cleaning_incidents_photo_delete_by_owner
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'cleaning-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND (storage.foldername(name))[2] = 'incidents'
    );
