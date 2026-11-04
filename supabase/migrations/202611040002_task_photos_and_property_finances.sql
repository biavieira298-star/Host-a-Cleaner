CREATE TABLE IF NOT EXISTS public.cleaning_task_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url text NOT NULL,
    storage_path text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_task_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cleaning_task_photos_select ON public.cleaning_task_photos;
CREATE POLICY cleaning_task_photos_select
    ON public.cleaning_task_photos FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.cleaning_tasks AS task
            JOIN public.properties AS property ON property.id = task.property_id
            WHERE task.id = cleaning_task_photos.task_id
              AND property.id = cleaning_task_photos.property_id
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.id = task.assigned_team_member_id
                        AND member.auth_user_id = auth.uid()
                  )
              )
        )
    );

DROP POLICY IF EXISTS cleaning_task_photos_insert ON public.cleaning_task_photos;
CREATE POLICY cleaning_task_photos_insert
    ON public.cleaning_task_photos FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.cleaning_tasks AS task
            JOIN public.properties AS property ON property.id = task.property_id
            WHERE task.id = cleaning_task_photos.task_id
              AND property.id = cleaning_task_photos.property_id
              AND (
                  property.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.team_members AS member
                      WHERE member.id = task.assigned_team_member_id
                        AND member.auth_user_id = auth.uid()
                  )
              )
        )
    );

CREATE TABLE IF NOT EXISTS public.property_financial_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_type text NOT NULL CHECK (entry_type IN ('income', 'expense')),
    amount numeric(12, 2) NOT NULL CHECK (amount > 0),
    description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 200),
    occurred_on date NOT NULL DEFAULT current_date,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_financial_entries_select ON public.property_financial_entries;
CREATE POLICY property_financial_entries_select
    ON public.property_financial_entries FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_financial_entries.property_id
              AND property.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS property_financial_entries_insert ON public.property_financial_entries;
CREATE POLICY property_financial_entries_insert
    ON public.property_financial_entries FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = property_financial_entries.property_id
              AND property.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS cleaning_task_photos_task_id_created_at_idx
    ON public.cleaning_task_photos (task_id, created_at);
CREATE INDEX IF NOT EXISTS property_financial_entries_user_property_idx
    ON public.property_financial_entries (user_id, property_id);

GRANT SELECT, INSERT ON public.cleaning_task_photos TO authenticated;
GRANT SELECT, INSERT ON public.property_financial_entries TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaning-photos', 'cleaning-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS cleaning_photos_upload_by_owner ON storage.objects;
CREATE POLICY cleaning_photos_upload_by_owner
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'cleaning-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
