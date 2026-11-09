ALTER TABLE public.property_incidents
    ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;
