ALTER TABLE public.property_financial_entries
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.property_financial_entries
    DROP CONSTRAINT IF EXISTS property_financial_entries_status_check;

ALTER TABLE public.property_financial_entries
    ADD CONSTRAINT property_financial_entries_status_check
    CHECK (status IN ('paid', 'pending'));

CREATE TABLE IF NOT EXISTS public.hosting_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    platform_name text NOT NULL CHECK (length(btrim(platform_name)) BETWEEN 1 AND 80),
    file_name text NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 160),
    file_url text NOT NULL,
    storage_path text NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hosting_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hosting_reports_select ON public.hosting_reports;
CREATE POLICY hosting_reports_select
    ON public.hosting_reports FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = hosting_reports.property_id
              AND property.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS hosting_reports_insert ON public.hosting_reports;
CREATE POLICY hosting_reports_insert
    ON public.hosting_reports FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = hosting_reports.property_id
              AND property.user_id = auth.uid()
        )
        AND split_part(storage_path, '/', 1) = auth.uid()::text
        AND split_part(storage_path, '/', 2) = property_id::text
    );

DROP POLICY IF EXISTS hosting_reports_delete ON public.hosting_reports;
CREATE POLICY hosting_reports_delete
    ON public.hosting_reports FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id = hosting_reports.property_id
              AND property.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS hosting_reports_property_uploaded_idx
    ON public.hosting_reports (property_id, uploaded_at DESC);

GRANT SELECT, INSERT, DELETE ON public.hosting_reports TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('hosting-reports', 'hosting-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS hosting_reports_storage_select ON storage.objects;
CREATE POLICY hosting_reports_storage_select
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'hosting-reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND property.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS hosting_reports_storage_insert ON storage.objects;
CREATE POLICY hosting_reports_storage_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'hosting-reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND property.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS hosting_reports_storage_delete ON storage.objects;
CREATE POLICY hosting_reports_storage_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'hosting-reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
            SELECT 1
            FROM public.properties AS property
            WHERE property.id::text = (storage.foldername(name))[2]
              AND property.user_id = auth.uid()
        )
    );
