ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_created bigint;
