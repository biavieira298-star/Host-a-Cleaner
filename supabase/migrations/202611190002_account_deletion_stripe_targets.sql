BEGIN;

ALTER TABLE public.account_deletion_jobs
    ADD COLUMN IF NOT EXISTS stripe_customer_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
    ADD COLUMN IF NOT EXISTS stripe_subscription_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION public.remember_account_deletion_stripe_targets(
    p_user_id uuid,
    p_customer_ids text[],
    p_subscription_ids text[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM unnest(coalesce(p_customer_ids, ARRAY[]::text[])) AS id
               WHERE id IS NULL OR id !~ '^cus_[a-zA-Z0-9]+$')
       OR EXISTS (SELECT 1 FROM unnest(coalesce(p_subscription_ids, ARRAY[]::text[])) AS id
                  WHERE id IS NULL OR id !~ '^sub_[a-zA-Z0-9]+$') THEN
        RAISE EXCEPTION 'Identificador Stripe inválido.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.account_deletion_jobs AS job
    SET stripe_customer_ids = ARRAY(
            SELECT DISTINCT id FROM unnest(job.stripe_customer_ids || coalesce(p_customer_ids, ARRAY[]::text[])) AS id ORDER BY id
        ),
        stripe_subscription_ids = ARRAY(
            SELECT DISTINCT id FROM unnest(job.stripe_subscription_ids || coalesce(p_subscription_ids, ARRAY[]::text[])) AS id ORDER BY id
        )
    WHERE job.user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eliminação não iniciada.' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remember_account_deletion_stripe_targets(uuid, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remember_account_deletion_stripe_targets(uuid, text[], text[]) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
