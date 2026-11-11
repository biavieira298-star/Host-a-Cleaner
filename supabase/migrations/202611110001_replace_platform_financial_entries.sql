CREATE OR REPLACE FUNCTION public.replace_platform_financial_entries(
    p_platform text,
    p_entries jsonb,
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

    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_platform, 0));

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
        user_id, property_id, entry_type, category, amount, description, occurred_on, entry_date, status
    )
    SELECT v_user_id, entry.property_id, entry.entry_type, entry.category, entry.amount,
        entry.description, entry.occurred_on, entry.occurred_on, entry.status
    FROM jsonb_to_recordset(p_entries) AS entry(
        property_id uuid, entry_type text, category text, amount numeric,
        description text, occurred_on date, status text
    );

    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_platform_financial_entries(text, jsonb, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_platform_financial_entries(text, jsonb, date) TO authenticated;
