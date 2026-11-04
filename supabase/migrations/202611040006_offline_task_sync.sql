ALTER TABLE public.cleaning_tasks
    ADD COLUMN IF NOT EXISTS checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_cleaning_task_start(
    p_task_id uuid,
    p_started_at timestamptz
)
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
    IF auth.uid() IS NULL OR p_started_at IS NULL THEN
        RAISE EXCEPTION 'Authentication and a start timestamp are required';
    END IF;

    SELECT task, property.user_id
    INTO task_row, task_manager_id
    FROM public.cleaning_tasks AS task
    JOIN public.properties AS property ON property.id = task.property_id
    WHERE task.id = p_task_id
    FOR UPDATE OF task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaning task not found';
    END IF;

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
    IF p_started_at > now() + interval '5 minutes' THEN
        RAISE EXCEPTION 'The start timestamp cannot be in the future';
    END IF;
    IF task_row.started_at IS NOT NULL THEN
        IF task_row.started_at = p_started_at AND task_row.status = 'in_progress' THEN
            RETURN task_row.started_at;
        END IF;
        RAISE EXCEPTION 'This cleaning task has already been started';
    END IF;
    IF task_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending tasks can be started';
    END IF;

    UPDATE public.cleaning_tasks
    SET status = 'in_progress',
        started_at = p_started_at
    WHERE id = p_task_id;

    RETURN p_started_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cleaning_task_completion(
    p_task_id uuid,
    p_started_at timestamptz,
    p_completed_at timestamptz,
    p_total_duration_minutes integer,
    p_checklist_state jsonb DEFAULT '{}'::jsonb
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
    IF p_started_at IS NULL OR p_completed_at IS NULL
       OR p_completed_at < p_started_at
       OR p_completed_at > now() + interval '5 minutes' THEN
        RAISE EXCEPTION 'Valid start and completion timestamps are required';
    END IF;
    IF p_total_duration_minutes IS NOT NULL
       AND (p_total_duration_minutes < 1 OR p_total_duration_minutes > 10080) THEN
        RAISE EXCEPTION 'The validated duration is outside the allowed range';
    END IF;

    SELECT task, property.user_id
    INTO task_row, task_manager_id
    FROM public.cleaning_tasks AS task
    JOIN public.properties AS property ON property.id = task.property_id
    WHERE task.id = p_task_id
    FOR UPDATE OF task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cleaning task not found';
    END IF;

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

    IF task_row.status = 'completed'
       AND task_row.started_at = p_started_at
       AND task_row.completed_at = p_completed_at
       AND task_row.total_duration_minutes = p_total_duration_minutes THEN
        RETURN;
    END IF;
    IF task_row.status <> 'in_progress' OR task_row.started_at IS DISTINCT FROM p_started_at THEN
        RAISE EXCEPTION 'The cleaning task start state has changed';
    END IF;

    SELECT coalesce(member.track_hours, false)
    INTO tracking_enabled
    FROM public.team_members AS member
    WHERE member.id = task_row.assigned_team_member_id;

    IF coalesce(tracking_enabled, false) AND p_total_duration_minutes IS NULL THEN
        RAISE EXCEPTION 'A validated cleaning duration is required';
    END IF;
    final_duration := coalesce(
        p_total_duration_minutes,
        greatest(1, round(extract(epoch FROM (p_completed_at - p_started_at)) / 60)::integer)
    );

    UPDATE public.cleaning_tasks
    SET status = 'completed',
        started_at = p_started_at,
        completed_at = p_completed_at,
        total_duration_minutes = final_duration,
        hours_spent = final_duration::numeric / 60,
        checklist_state = coalesce(p_checklist_state, '{}'::jsonb)
    WHERE id = p_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_cleaning_task_start(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_cleaning_task_start(uuid, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_cleaning_task_completion(uuid, timestamptz, timestamptz, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_cleaning_task_completion(uuid, timestamptz, timestamptz, integer, jsonb) TO authenticated;

DROP POLICY IF EXISTS cleaning_photos_select_by_owner ON storage.objects;
CREATE POLICY cleaning_photos_select_by_owner
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'cleaning-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS cleaning_photos_update_by_owner ON storage.objects;
CREATE POLICY cleaning_photos_update_by_owner
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'cleaning-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'cleaning-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
