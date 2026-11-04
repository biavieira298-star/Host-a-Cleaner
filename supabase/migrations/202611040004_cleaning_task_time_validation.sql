ALTER TABLE public.cleaning_tasks
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS total_duration_minutes integer
        CHECK (total_duration_minutes IS NULL OR total_duration_minutes BETWEEN 1 AND 10080);

CREATE OR REPLACE FUNCTION public.start_cleaning_task(p_task_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    task_row public.cleaning_tasks%ROWTYPE;
    task_manager_id uuid;
    is_assigned_cleaner boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT property.user_id
    INTO task_manager_id
    FROM public.cleaning_tasks AS task
    JOIN public.properties AS property ON property.id = task.property_id
    WHERE task.id = p_task_id
    FOR UPDATE OF task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaning task not found';
    END IF;
    SELECT * INTO task_row
    FROM public.cleaning_tasks
    WHERE id = p_task_id;

    SELECT EXISTS (
        SELECT 1
        FROM public.team_members AS member
        WHERE member.id = task_row.assigned_team_member_id
          AND member.auth_user_id = auth.uid()
          AND member.role = 'cleaner'
    ) INTO is_assigned_cleaner;

    IF NOT is_assigned_cleaner AND task_manager_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'You are not allowed to start this cleaning task';
    END IF;
    IF task_row.status NOT IN ('pending', 'in_progress') THEN
        RAISE EXCEPTION 'Only pending or in-progress tasks can be started';
    END IF;
    IF task_row.started_at IS NOT NULL THEN
        RAISE EXCEPTION 'This cleaning task has already been started';
    END IF;

    UPDATE public.cleaning_tasks
    SET status = 'in_progress',
        started_at = now()
    WHERE id = p_task_id
    RETURNING started_at INTO task_row.started_at;

    RETURN task_row.started_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_cleaning_task(
    p_task_id uuid,
    p_total_duration_minutes integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    task_row public.cleaning_tasks%ROWTYPE;
    task_manager_id uuid;
    tracking_enabled boolean;
    is_assigned_cleaner boolean;
    final_duration integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT property.user_id
    INTO task_manager_id
    FROM public.cleaning_tasks AS task
    JOIN public.properties AS property ON property.id = task.property_id
    WHERE task.id = p_task_id
    FOR UPDATE OF task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaning task not found';
    END IF;
    SELECT * INTO task_row
    FROM public.cleaning_tasks
    WHERE id = p_task_id;

    SELECT EXISTS (
        SELECT 1
        FROM public.team_members AS member
        WHERE member.id = task_row.assigned_team_member_id
          AND member.auth_user_id = auth.uid()
          AND member.role = 'cleaner'
    ) INTO is_assigned_cleaner;

    IF NOT is_assigned_cleaner AND task_manager_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'You are not allowed to complete this cleaning task';
    END IF;
    IF task_row.status <> 'in_progress' OR task_row.started_at IS NULL THEN
        RAISE EXCEPTION 'Start the cleaning task before completing it';
    END IF;

    SELECT coalesce(member.track_hours, false)
    INTO tracking_enabled
    FROM public.team_members AS member
    WHERE member.id = task_row.assigned_team_member_id;

    IF coalesce(tracking_enabled, false) THEN
        IF p_total_duration_minutes IS NULL
           OR p_total_duration_minutes < 1
           OR p_total_duration_minutes > 10080 THEN
            RAISE EXCEPTION 'A validated cleaning duration is required';
        END IF;
        final_duration := p_total_duration_minutes;
    ELSE
        final_duration := greatest(
            1,
            round(extract(epoch FROM (now() - task_row.started_at)) / 60)::integer
        );
    END IF;

    UPDATE public.cleaning_tasks
    SET status = 'completed',
        completed_at = now(),
        total_duration_minutes = final_duration,
        hours_spent = final_duration::numeric / 60
    WHERE id = p_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_cleaning_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_cleaning_task(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.complete_cleaning_task(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_cleaning_task(uuid, integer) TO authenticated;
