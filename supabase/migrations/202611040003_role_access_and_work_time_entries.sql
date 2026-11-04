CREATE OR REPLACE FUNCTION public.current_cleaner_manager_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT manager_id
    FROM public.team_members
    WHERE auth_user_id = auth.uid()
      AND role = 'cleaner'
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_cleaner_manager_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_cleaner_manager_id() TO authenticated;

DROP POLICY IF EXISTS team_members_manager_select ON public.team_members;
CREATE POLICY team_members_manager_select
    ON public.team_members FOR SELECT TO authenticated
    USING (
        manager_id = auth.uid()
        OR auth_user_id = auth.uid()
        OR manager_id = public.current_cleaner_manager_id()
    );

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS properties_owner_or_assigned_cleaner_select ON public.properties;
CREATE POLICY properties_owner_or_assigned_cleaner_select
    ON public.properties FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.team_members AS member
            WHERE member.id = properties.assigned_team_member_id
              AND member.auth_user_id = auth.uid()
              AND member.role = 'cleaner'
        )
    );

DROP POLICY IF EXISTS properties_owner_insert ON public.properties;
CREATE POLICY properties_owner_insert
    ON public.properties FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS properties_owner_update ON public.properties;
CREATE POLICY properties_owner_update
    ON public.properties FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS properties_owner_delete ON public.properties;
CREATE POLICY properties_owner_delete
    ON public.properties FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.work_time_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    task_id uuid REFERENCES public.cleaning_tasks(id) ON DELETE SET NULL,
    work_date date NOT NULL DEFAULT current_date,
    hours numeric(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_time_entries_select_own_or_managed ON public.work_time_entries;
CREATE POLICY work_time_entries_select_own_or_managed
    ON public.work_time_entries FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR manager_id = auth.uid());

DROP POLICY IF EXISTS work_time_entries_insert_own ON public.work_time_entries;
CREATE POLICY work_time_entries_insert_own
    ON public.work_time_entries FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.team_members AS member
            WHERE member.id = work_time_entries.team_member_id
              AND member.auth_user_id = auth.uid()
              AND member.role = 'cleaner'
              AND member.manager_id = work_time_entries.manager_id
        )
        AND (
            property_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.properties AS property
                WHERE property.id = work_time_entries.property_id
                  AND property.user_id = work_time_entries.manager_id
                  AND property.assigned_team_member_id = work_time_entries.team_member_id
            )
        )
        AND (
            task_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.cleaning_tasks AS task
                WHERE task.id = work_time_entries.task_id
                  AND task.assigned_team_member_id = work_time_entries.team_member_id
                  AND (property_id IS NULL OR task.property_id = work_time_entries.property_id)
            )
        )
    );

CREATE INDEX IF NOT EXISTS work_time_entries_user_date_idx
    ON public.work_time_entries (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS work_time_entries_manager_date_idx
    ON public.work_time_entries (manager_id, work_date DESC);

GRANT SELECT ON public.work_time_entries TO authenticated;
GRANT INSERT ON public.work_time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
