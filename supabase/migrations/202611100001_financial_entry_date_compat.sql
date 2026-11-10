ALTER TABLE public.property_financial_entries
    ADD COLUMN IF NOT EXISTS entry_date date;

UPDATE public.property_financial_entries
SET entry_date = occurred_on
WHERE entry_date IS NULL AND occurred_on IS NOT NULL;

ALTER TABLE public.property_financial_entries
    ALTER COLUMN entry_date SET DEFAULT current_date;
