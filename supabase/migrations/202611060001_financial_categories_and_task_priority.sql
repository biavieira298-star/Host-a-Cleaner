ALTER TABLE public.property_financial_entries
    ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Geral'
        CHECK (length(btrim(category)) BETWEEN 1 AND 80);

ALTER TABLE public.cleaning_tasks
    ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;
