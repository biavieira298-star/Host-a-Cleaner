ALTER TABLE public.property_financial_entries
    ADD COLUMN IF NOT EXISTS platform_document_id uuid;

ALTER TABLE public.property_financial_entries
    ADD CONSTRAINT property_financial_entries_platform_document_id_fkey
    FOREIGN KEY (platform_document_id)
    REFERENCES public.platform_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS property_financial_entries_platform_document_id_idx
    ON public.property_financial_entries (platform_document_id);

DROP POLICY IF EXISTS property_financial_entries_insert ON public.property_financial_entries;
CREATE POLICY property_financial_entries_insert
    ON public.property_financial_entries FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.properties AS property
            WHERE property.id = property_financial_entries.property_id
                AND property.user_id = auth.uid()
        )
        AND (
            platform_document_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.platform_documents AS document
                WHERE document.id = property_financial_entries.platform_document_id
                    AND document.user_id = auth.uid()
            )
        )
    );

CREATE OR REPLACE FUNCTION public.replace_document_financial_entries(
    p_platform text,
    p_entries jsonb,
    p_document_id uuid,
    p_extra_month date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_platform IS NULL OR p_platform NOT IN ('Airbnb', 'Booking.com') THEN
        RAISE EXCEPTION 'Invalid platform';
    END IF;
    IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
        RAISE EXCEPTION 'Entries must be an array';
    END IF;
    IF jsonb_array_length(p_entries) = 0 THEN
        RAISE EXCEPTION 'No entries to import';
    END IF;
    IF p_extra_month IS NOT NULL AND p_extra_month <> date_trunc('month', p_extra_month)::date THEN
        RAISE EXCEPTION 'Extra month must start on the first day of a month';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_platform, 0));
    PERFORM 1 FROM public.platform_documents
        WHERE id = p_document_id AND user_id = v_user_id AND platform = p_platform
        FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found or platform does not match';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_entries) AS entry(
            property_id uuid, entry_type text, category text, amount numeric,
            description text, occurred_on date, status text
        )
        LEFT JOIN public.properties AS property
            ON property.id = entry.property_id AND property.user_id = v_user_id
        WHERE property.id IS NULL
            OR entry.entry_type IS DISTINCT FROM 'income'
            OR entry.amount IS NULL OR entry.amount <= 0
            OR entry.occurred_on IS NULL
            OR entry.description IS NULL
            OR left(entry.description, length(p_platform) + 1) <> p_platform || ':'
            OR entry.status IS DISTINCT FROM 'paid'
            OR entry.category IS NULL
    ) THEN
        RAISE EXCEPTION 'Invalid platform entries or property ownership';
    END IF;
    IF (SELECT count(DISTINCT occurred_on)
        FROM jsonb_to_recordset(p_entries) AS entry(occurred_on date)) <> 1
        OR EXISTS (
            SELECT 1 FROM jsonb_to_recordset(p_entries) AS entry(occurred_on date)
            WHERE entry.occurred_on <> date_trunc('month', entry.occurred_on)::date
        ) THEN
        RAISE EXCEPTION 'Entries must use the same report month';
    END IF;

    DELETE FROM public.property_financial_entries AS existing
    WHERE existing.user_id = v_user_id
        AND existing.entry_type = 'income'
        AND left(existing.description, length(p_platform) + 1) = p_platform || ':'
        AND (
            (p_extra_month IS NOT NULL
                AND existing.occurred_on >= p_extra_month
                AND existing.occurred_on < (p_extra_month + interval '1 month')::date)
            OR EXISTS (
                SELECT 1
                FROM jsonb_to_recordset(p_entries) AS entry(occurred_on date)
                WHERE existing.occurred_on >= date_trunc('month', entry.occurred_on)::date
                    AND existing.occurred_on < (date_trunc('month', entry.occurred_on) + interval '1 month')::date
            )
        );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    INSERT INTO public.property_financial_entries (
        user_id, property_id, entry_type, category, amount, description,
        occurred_on, entry_date, status, platform_document_id
    )
    SELECT v_user_id, entry.property_id, entry.entry_type, entry.category, entry.amount,
        entry.description, entry.occurred_on, entry.occurred_on, entry.status, p_document_id
    FROM jsonb_to_recordset(p_entries) AS entry(
        property_id uuid, entry_type text, category text, amount numeric,
        description text, occurred_on date, status text
    );

    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_document_financial_entries(text, jsonb, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_document_financial_entries(text, jsonb, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_platform_financial_entries(text, jsonb, date) FROM authenticated;
