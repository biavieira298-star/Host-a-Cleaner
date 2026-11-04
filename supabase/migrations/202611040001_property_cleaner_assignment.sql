ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS assigned_team_member_id uuid
    REFERENCES public.team_members(id) ON DELETE SET NULL;
