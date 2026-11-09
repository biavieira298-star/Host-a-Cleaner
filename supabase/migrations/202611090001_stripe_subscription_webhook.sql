ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
    ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_subscription_event_created bigint;

CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
    ON public.profiles (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
