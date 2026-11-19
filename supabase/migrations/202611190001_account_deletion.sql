BEGIN;

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
    user_id uuid PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_deletion_jobs TO service_role;

CREATE TABLE IF NOT EXISTS public.account_deletion_tombstones (
    user_id uuid PRIMARY KEY,
    deleted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_tombstones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_deletion_tombstones TO service_role;

CREATE OR REPLACE FUNCTION public.account_deletion_is_writable(p_owner text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_owner IS NULL OR p_owner = '' THEN RETURN true; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner, 31829));
    RETURN NOT EXISTS (
        SELECT 1 FROM public.account_deletion_jobs WHERE user_id::text = p_owner
    );
END;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_is_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_deletion_is_writable(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_deletion_guard_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    row_data jsonb;
    owner text;
BEGIN
    IF auth.role() = 'service_role'
       AND pg_catalog.current_setting('app.account_deletion', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    FOR row_data IN
        SELECT value FROM pg_catalog.jsonb_array_elements(
            CASE WHEN TG_OP = 'INSERT' THEN pg_catalog.jsonb_build_array(to_jsonb(NEW))
                 WHEN TG_OP = 'DELETE' THEN pg_catalog.jsonb_build_array(to_jsonb(OLD))
                 ELSE pg_catalog.jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW)) END
        )
    LOOP
        FOR owner IN
            SELECT DISTINCT candidate FROM (
                SELECT row_data->>'owner_id' AS candidate
                UNION ALL SELECT row_data->>'manager_id'
                UNION ALL SELECT row_data->>'user_id'
                UNION ALL SELECT row_data->>'auth_user_id'
                UNION ALL SELECT row_data->>'accepted_invite_user_id'
                UNION ALL SELECT row_data->>'uploaded_by'
                UNION ALL SELECT row_data->>'created_by'
                UNION ALL SELECT CASE WHEN TG_TABLE_NAME = 'profiles' THEN row_data->>'id' END
                UNION ALL SELECT property.user_id::text FROM public.properties AS property
                    WHERE property.id::text = row_data->>'property_id'
                UNION ALL SELECT property.user_id::text
                    FROM public.cleaning_tasks AS task
                    JOIN public.properties AS property ON property.id = task.property_id
                    WHERE task.id::text = row_data->>'task_id'
                UNION ALL SELECT coalesce(member.owner_id, member.manager_id)::text FROM public.team_members AS member
                    WHERE member.auth_user_id = auth.uid()
            ) AS candidates WHERE candidate IS NOT NULL AND candidate <> ''
            ORDER BY candidate
        LOOP
            IF NOT public.account_deletion_is_writable(owner) THEN
                RAISE EXCEPTION 'A eliminação desta conta está em curso.' USING ERRCODE = '55000';
            END IF;
        END LOOP;
    END LOOP;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_guard_row() FROM PUBLIC;

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'profiles', 'team_members', 'properties', 'cleaning_tasks', 'cleaning_photos',
        'cleaning_task_photos', 'property_incidents', 'work_time_entries',
        'property_financial_entries', 'platform_documents', 'hosting_reports'
    ] LOOP
        IF pg_catalog.to_regclass('public.' || table_name) IS NOT NULL THEN
            EXECUTE pg_catalog.format('DROP TRIGGER IF EXISTS account_deletion_guard ON public.%I', table_name);
            EXECUTE pg_catalog.format(
                'CREATE TRIGGER account_deletion_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.account_deletion_guard_row()',
                table_name
            );
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_storage_writable(p_bucket text, p_path text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE owner text;
BEGIN
    IF p_bucket NOT IN ('cleaning-photos', 'property-incidents', 'platform-documents', 'hosting-reports') THEN
        RETURN true;
    END IF;
    FOR owner IN
        SELECT DISTINCT candidate FROM (
            SELECT split_part(p_path, '/', 1) AS candidate
            UNION ALL SELECT auth.uid()::text
            UNION ALL SELECT coalesce(member.owner_id, member.manager_id)::text FROM public.team_members AS member
                WHERE member.auth_user_id = auth.uid()
        ) AS candidates WHERE candidate IS NOT NULL AND candidate <> ''
        ORDER BY candidate
    LOOP
        IF NOT public.account_deletion_is_writable(owner) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_storage_writable(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_deletion_storage_writable(text, text) TO authenticated;

DROP POLICY IF EXISTS account_deletion_storage_guard ON storage.objects;
CREATE POLICY account_deletion_storage_guard ON storage.objects AS RESTRICTIVE
    FOR ALL TO authenticated
    USING (public.account_deletion_storage_writable(bucket_id, name))
    WITH CHECK (public.account_deletion_storage_writable(bucket_id, name));

CREATE OR REPLACE FUNCTION public.begin_account_deletion(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    account_role text;
    dependency record;
    has_rows boolean;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 31829));
    SELECT role::text INTO account_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF account_role NOT IN ('admin', 'cleaner') OR account_role IS NULL THEN
        RAISE EXCEPTION 'Perfil ou cargo inválido.' USING ERRCODE = '42501';
    END IF;
    IF account_role = 'cleaner' AND (
        EXISTS (SELECT 1 FROM public.properties WHERE user_id = p_user_id)
        OR EXISTS (SELECT 1 FROM public.team_members WHERE owner_id = p_user_id OR manager_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'A conta possui dados de gestão e requer revisão.' USING ERRCODE = '55000';
    END IF;
    FOR dependency IN
        SELECT ns.nspname, rel.relname, attr.attname, constraint_def.conname,
               cardinality(constraint_def.conkey) AS key_count
        FROM pg_catalog.pg_constraint AS constraint_def
        JOIN pg_catalog.pg_class AS rel ON rel.oid = constraint_def.conrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = rel.relnamespace
        JOIN pg_catalog.pg_attribute AS attr ON attr.attrelid = rel.oid AND attr.attnum = constraint_def.conkey[1]
        WHERE constraint_def.contype = 'f' AND constraint_def.confrelid = 'public.team_members'::regclass
          AND NOT (ns.nspname = 'public' AND rel.relname = 'cleaning_tasks'
                   AND attr.attname = 'assigned_team_member_id' AND constraint_def.confdeltype = 'n')
    LOOP
        IF dependency.key_count <> 1 THEN
            RAISE EXCEPTION 'Dependência composta de membros requer revisão: %', dependency.conname;
        END IF;
        EXECUTE pg_catalog.format(
            'SELECT EXISTS (SELECT 1 FROM %I.%I AS r JOIN public.team_members AS m ON r.%I::text = m.id::text WHERE %s)',
            dependency.nspname, dependency.relname, dependency.attname,
            CASE WHEN account_role = 'admin' THEN '(m.owner_id = $1 OR m.manager_id = $1)' ELSE 'm.auth_user_id = $1' END
        ) INTO has_rows USING p_user_id;
        IF has_rows THEN RAISE EXCEPTION 'Dependência de membros requer revisão: %', dependency.conname; END IF;
    END LOOP;
    FOR dependency IN
        SELECT ns.nspname, rel.relname, attr.attname, constraint_def.conname,
               cardinality(constraint_def.conkey) AS key_count
        FROM pg_catalog.pg_constraint AS constraint_def
        JOIN pg_catalog.pg_class AS rel ON rel.oid = constraint_def.conrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = rel.relnamespace
        JOIN pg_catalog.pg_attribute AS attr ON attr.attrelid = rel.oid AND attr.attnum = constraint_def.conkey[1]
        WHERE constraint_def.contype = 'f' AND constraint_def.confrelid = 'auth.users'::regclass
          AND ns.nspname <> 'auth'
          AND NOT (
              ns.nspname = 'public' AND (
                  (rel.relname = 'profiles' AND attr.attname = 'id')
                  OR (account_role = 'cleaner' AND rel.relname = 'team_members'
                      AND attr.attname IN ('auth_user_id', 'accepted_invite_user_id'))
                  OR (account_role = 'admin' AND (
                      (rel.relname = 'properties' AND attr.attname = 'user_id')
                      OR (rel.relname = 'team_members' AND attr.attname IN ('owner_id', 'manager_id'))
                      OR (rel.relname IN ('platform_documents', 'property_financial_entries') AND attr.attname = 'user_id')
                      OR (rel.relname = 'work_time_entries' AND attr.attname = 'owner_id')
                  ))
              )
          )
    LOOP
        IF dependency.key_count <> 1 THEN
            RAISE EXCEPTION 'Dependência composta da conta requer revisão: %', dependency.conname;
        END IF;
        EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I::text = $1::text)',
            dependency.nspname, dependency.relname, dependency.attname)
            INTO has_rows USING p_user_id;
        IF has_rows THEN RAISE EXCEPTION 'Dependência da conta requer revisão: %', dependency.conname; END IF;
    END LOOP;
    IF account_role = 'admin' THEN
        IF EXISTS (
            SELECT 1 FROM public.team_members AS member
            WHERE (member.owner_id = p_user_id AND member.manager_id IS NOT NULL AND member.manager_id <> p_user_id)
               OR (member.manager_id = p_user_id AND member.owner_id IS NOT NULL AND member.owner_id <> p_user_id)
        ) THEN
            RAISE EXCEPTION 'Um membro tem gestores inconsistentes e requer revisão.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.cleaning_task_photos AS photo
            JOIN public.cleaning_tasks AS task ON task.id = photo.task_id
            JOIN public.properties AS property ON property.id = task.property_id
            WHERE (property.user_id = p_user_id OR photo.property_id IN (
                SELECT id::text FROM public.properties WHERE user_id = p_user_id
            )) AND photo.property_id IS NOT NULL AND photo.property_id <> property.id::text
        ) THEN
            RAISE EXCEPTION 'Uma fotografia tem referências de alojamento inconsistentes.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.platform_documents AS document
            JOIN public.properties AS property ON property.id = document.property_id
            WHERE (property.user_id = p_user_id AND document.user_id <> p_user_id)
               OR (document.user_id = p_user_id AND property.user_id IS DISTINCT FROM p_user_id)
        ) OR EXISTS (
            SELECT 1 FROM public.property_financial_entries AS entry
            JOIN public.properties AS property ON property.id = entry.property_id
            WHERE (property.user_id = p_user_id AND entry.user_id IS NOT NULL AND entry.user_id <> p_user_id)
               OR (entry.user_id = p_user_id AND property.user_id IS DISTINCT FROM p_user_id)
        ) OR EXISTS (
            SELECT 1 FROM public.work_time_entries AS entry
            JOIN public.properties AS property ON property.id = entry.property_id
            WHERE (property.user_id = p_user_id AND entry.owner_id IS NOT NULL AND entry.owner_id <> p_user_id)
               OR (entry.owner_id = p_user_id AND property.user_id IS DISTINCT FROM p_user_id)
        ) OR EXISTS (
            SELECT 1 FROM public.hosting_reports AS report
            JOIN public.properties AS property ON property.id = report.property_id
            WHERE to_jsonb(report)->>'uploaded_by' = p_user_id::text AND property.user_id IS DISTINCT FROM p_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.property_financial_entries AS entry
            JOIN public.platform_documents AS document
              ON document.id = entry.platform_document_id OR document.id::text = to_jsonb(entry)->>'document_id'
            JOIN public.properties AS property ON property.id = entry.property_id
            WHERE document.user_id = p_user_id AND property.user_id IS DISTINCT FROM p_user_id
        ) THEN
            RAISE EXCEPTION 'Existem registos associados a outra organização que requerem revisão.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.cleaning_task_photos AS photo
            JOIN public.properties AS property ON property.id::text = photo.property_id::text
            WHERE photo.uploaded_by = p_user_id AND property.user_id IS DISTINCT FROM p_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.property_incidents AS incident
            JOIN public.properties AS property ON property.id = incident.property_id
            WHERE (incident.created_by::text = p_user_id::text OR to_jsonb(incident)->>'reported_by' = p_user_id::text)
              AND property.user_id IS DISTINCT FROM p_user_id
        ) THEN
            RAISE EXCEPTION 'Existem fotografias ou ocorrências de outra organização que requerem revisão.';
        END IF;
        FOR dependency IN
            SELECT ns.nspname, rel.relname, attr.attname, parent.relname AS parent_name,
                   parent_attr.attname AS parent_column, constraint_def.conname,
                   cardinality(constraint_def.conkey) AS key_count
            FROM pg_catalog.pg_constraint AS constraint_def
            JOIN pg_catalog.pg_class AS rel ON rel.oid = constraint_def.conrelid
            JOIN pg_catalog.pg_namespace AS ns ON ns.oid = rel.relnamespace
            JOIN pg_catalog.pg_attribute AS attr ON attr.attrelid = rel.oid AND attr.attnum = constraint_def.conkey[1]
            JOIN pg_catalog.pg_class AS parent ON parent.oid = constraint_def.confrelid
            JOIN pg_catalog.pg_attribute AS parent_attr ON parent_attr.attrelid = parent.oid AND parent_attr.attnum = constraint_def.confkey[1]
            WHERE constraint_def.contype = 'f'
              AND constraint_def.confrelid IN ('public.properties'::regclass, 'public.cleaning_tasks'::regclass, 'public.platform_documents'::regclass)
              AND NOT (
                  ns.nspname = 'public' AND (
                      (parent.relname = 'properties' AND attr.attname = 'property_id'
                       AND rel.relname IN ('cleaning_tasks', 'hosting_reports', 'property_financial_entries', 'property_incidents', 'work_time_entries', 'platform_documents'))
                      OR (parent.relname = 'cleaning_tasks' AND attr.attname = 'task_id'
                          AND rel.relname IN ('cleaning_task_photos', 'cleaning_photos'))
                      OR (parent.relname = 'platform_documents' AND rel.relname = 'property_financial_entries'
                          AND attr.attname IN ('document_id', 'platform_document_id'))
                  )
              )
        LOOP
            IF dependency.key_count <> 1 THEN
                RAISE EXCEPTION 'Dependência composta de dados requer revisão: %', dependency.conname;
            END IF;
            EXECUTE pg_catalog.format(
                'SELECT EXISTS (SELECT 1 FROM %I.%I AS r JOIN public.%I AS parent ON r.%I::text = parent.%I::text WHERE %s)',
                dependency.nspname, dependency.relname, dependency.parent_name, dependency.attname, dependency.parent_column,
                CASE dependency.parent_name
                    WHEN 'properties' THEN 'parent.user_id = $1'
                    WHEN 'cleaning_tasks' THEN 'parent.property_id IN (SELECT id FROM public.properties WHERE user_id = $1)'
                    ELSE '(parent.user_id = $1 OR parent.property_id IN (SELECT id FROM public.properties WHERE user_id = $1))'
                END
            ) INTO has_rows USING p_user_id;
            IF has_rows THEN RAISE EXCEPTION 'Dependência de dados requer revisão: %', dependency.conname; END IF;
        END LOOP;
        IF EXISTS (
            SELECT 1 FROM public.work_time_entries AS entry
            WHERE entry.owner_id IS NULL AND entry.property_id IS NULL
              AND EXISTS (SELECT 1 FROM public.team_members AS member
                  WHERE (member.owner_id = p_user_id OR member.manager_id = p_user_id)
                    AND member.auth_user_id = entry.user_id)
        ) THEN
            RAISE EXCEPTION 'Existem registos de horas sem organização identificável.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.cleaning_tasks AS task
            JOIN public.team_members AS member ON member.id = task.assigned_team_member_id
            LEFT JOIN public.properties AS property ON property.id = task.property_id
            WHERE (member.owner_id = p_user_id OR member.manager_id = p_user_id)
              AND property.user_id IS DISTINCT FROM p_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.properties AS property
            JOIN public.team_members AS member ON member.id = property.assigned_team_member_id
            WHERE (member.owner_id = p_user_id OR member.manager_id = p_user_id)
              AND property.user_id IS DISTINCT FROM p_user_id
        ) THEN
            RAISE EXCEPTION 'Existem atribuições a outra organização que requerem revisão.';
        END IF;
        INSERT INTO public.account_deletion_jobs (user_id) VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        PERFORM 1 FROM public.account_deletion_objects(p_user_id) LIMIT 1;
    END IF;
    RETURN account_role;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_account_deletion(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.account_deletion_photo_references(p_user_id uuid)
RETURNS TABLE(bucket text, property_id text, path text, author text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT 'cleaning-photos', property.id::text, reference.path, photo.uploaded_by::text
    FROM public.cleaning_task_photos AS photo
    LEFT JOIN public.cleaning_tasks AS task ON task.id = photo.task_id
    JOIN public.properties AS property ON property.id::text = coalesce(task.property_id::text, photo.property_id::text)
    CROSS JOIN LATERAL unnest(ARRAY[photo.storage_path, photo.photo_url]) AS reference(path)
    WHERE property.user_id IS NOT DISTINCT FROM p_user_id AND reference.path IS NOT NULL
    UNION ALL
    SELECT 'cleaning-photos', property.id::text, photo.photo_url, member.auth_user_id::text
    FROM public.cleaning_photos AS photo
    JOIN public.cleaning_tasks AS task ON task.id = photo.task_id
    JOIN public.properties AS property ON property.id = task.property_id
    LEFT JOIN public.team_members AS member ON member.id = task.assigned_team_member_id
    WHERE property.user_id IS NOT DISTINCT FROM p_user_id AND photo.photo_url IS NOT NULL
    UNION ALL
    SELECT 'cleaning-photos', property.id::text, reference.path, member.auth_user_id::text
    FROM public.cleaning_tasks AS task
    JOIN public.properties AS property ON property.id = task.property_id
    LEFT JOIN public.team_members AS member ON member.id = task.assigned_team_member_id
    CROSS JOIN LATERAL unnest(ARRAY[to_jsonb(task)->>'photo_before_url', to_jsonb(task)->>'photo_after_url']) AS reference(path)
    WHERE property.user_id IS NOT DISTINCT FROM p_user_id AND reference.path IS NOT NULL
    UNION ALL
    SELECT bucket.bucket, property.id::text, reference.path, coalesce(incident.created_by::text, to_jsonb(incident)->>'reported_by')
    FROM public.property_incidents AS incident
    JOIN public.properties AS property ON property.id = incident.property_id
    CROSS JOIN LATERAL unnest(coalesce(incident.photos, ARRAY[]::text[]) || ARRAY[incident.photo_url]) AS reference(path)
    CROSS JOIN (VALUES ('cleaning-photos'::text), ('property-incidents'::text)) AS bucket(bucket)
    WHERE property.user_id IS NOT DISTINCT FROM p_user_id AND reference.path IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_photo_references(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_photo_references(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.account_deletion_reference_matches(p_reference text, p_bucket text, p_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_reference = p_name OR EXISTS (
        SELECT 1 FROM unnest(ARRAY['public', 'sign', 'authenticated']) AS route(kind)
        WHERE right(split_part(p_reference, '?', 1), length('/storage/v1/object/' || route.kind || '/' || p_bucket || '/' || p_name))
            = '/storage/v1/object/' || route.kind || '/' || p_bucket || '/' || p_name
    );
$$;
REVOKE ALL ON FUNCTION public.account_deletion_reference_matches(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.account_deletion_objects(p_user_id uuid)
RETURNS TABLE(bucket_id text, name text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.account_deletion_jobs WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'Eliminação não iniciada.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1 FROM (SELECT DISTINCT user_id FROM public.properties WHERE user_id IS DISTINCT FROM p_user_id) AS foreign_owner
        CROSS JOIN LATERAL public.account_deletion_photo_references(foreign_owner.user_id) AS reference
        JOIN storage.objects AS object ON object.bucket_id = reference.bucket
            AND split_part(object.name, '/', 1) = p_user_id::text
            AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
    ) OR EXISTS (
        SELECT 1 FROM (
            SELECT 'platform-documents'::text AS bucket, document.file_url AS path
            FROM public.platform_documents AS document
            WHERE document.user_id IS DISTINCT FROM p_user_id
            UNION ALL
            SELECT 'hosting-reports', reference.path
            FROM public.hosting_reports AS report
            LEFT JOIN public.properties AS property ON property.id = report.property_id
            CROSS JOIN LATERAL unnest(ARRAY[report.storage_path, report.file_url]) AS reference(path)
            WHERE property.user_id IS DISTINCT FROM p_user_id
              AND to_jsonb(report)->>'uploaded_by' IS DISTINCT FROM p_user_id::text
        ) AS reference
        JOIN storage.objects AS object ON object.bucket_id = reference.bucket
            AND split_part(object.name, '/', 1) = p_user_id::text
            AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
    ) THEN
        RAISE EXCEPTION 'Um ficheiro está associado a outra organização e requer revisão.' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.account_deletion_photo_references(p_user_id) AS reference
        JOIN storage.objects AS object ON object.bucket_id = reference.bucket
            AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
        WHERE split_part(object.name, '/', 1) <> p_user_id::text
          AND (split_part(object.name, '/', 2) <> reference.property_id
               OR split_part(object.name, '/', 1) IS DISTINCT FROM reference.author)
    ) THEN
        RAISE EXCEPTION 'Uma fotografia antiga tem um caminho de origem ambígua e requer revisão.' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
        SELECT 1 FROM storage.objects AS object
        JOIN public.properties AS property ON property.id::text = split_part(object.name, '/', 2)
        WHERE property.user_id = p_user_id
          AND object.bucket_id IN ('cleaning-photos', 'property-incidents')
          AND split_part(object.name, '/', 1) <> p_user_id::text
          AND NOT EXISTS (
              SELECT 1 FROM public.account_deletion_photo_references(p_user_id) AS reference
              WHERE reference.bucket = object.bucket_id AND reference.property_id = property.id::text
                AND reference.author = split_part(object.name, '/', 1)
                AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
          )
    ) THEN
        RAISE EXCEPTION 'Existe uma fotografia antiga sem referência verificável e requer revisão.' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT 'platform-documents'::text AS bucket, document.file_url AS path
            FROM public.platform_documents AS document
            WHERE document.user_id = p_user_id OR document.property_id IN (
                SELECT id FROM public.properties WHERE user_id = p_user_id
            )
            UNION ALL
            SELECT 'hosting-reports', reference.path
            FROM public.hosting_reports AS report
            CROSS JOIN LATERAL unnest(ARRAY[report.storage_path, report.file_url]) AS reference(path)
            WHERE to_jsonb(report)->>'uploaded_by' = p_user_id::text OR report.property_id IN (
                SELECT id FROM public.properties WHERE user_id = p_user_id
            )
        ) AS reference
        JOIN storage.objects AS object ON object.bucket_id = reference.bucket
            AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
        WHERE split_part(object.name, '/', 1) <> p_user_id::text
    ) THEN
        RAISE EXCEPTION 'Um documento tem um caminho de origem ambígua e requer revisão.' USING ERRCODE = '55000';
    END IF;
    RETURN QUERY
    SELECT object.bucket_id::text, object.name::text
    FROM storage.objects AS object
    WHERE object.bucket_id IN ('cleaning-photos', 'property-incidents', 'platform-documents', 'hosting-reports')
      AND (
          split_part(object.name, '/', 1) = p_user_id::text
          OR EXISTS (
              SELECT 1 FROM public.account_deletion_photo_references(p_user_id) AS reference
              WHERE reference.bucket = object.bucket_id
                AND reference.property_id = split_part(object.name, '/', 2)
                AND reference.author = split_part(object.name, '/', 1)
                AND public.account_deletion_reference_matches(reference.path, object.bucket_id, object.name)
          )
      )
    ORDER BY object.bucket_id, object.name
    LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.account_deletion_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_objects(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_account_deletion(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    account_role text;
    dependency record;
    has_rows boolean;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 31829));
    SELECT role::text INTO account_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF account_role IS DISTINCT FROM p_role OR account_role NOT IN ('admin', 'cleaner') THEN
        RAISE EXCEPTION 'Perfil ou cargo inválido.' USING ERRCODE = '42501';
    END IF;
    PERFORM pg_catalog.set_config('app.account_deletion', 'on', true);
    IF account_role = 'admin' THEN
        IF NOT EXISTS (SELECT 1 FROM public.account_deletion_jobs WHERE user_id = p_user_id) THEN
            RAISE EXCEPTION 'A eliminação não foi iniciada.' USING ERRCODE = '55000';
        END IF;
        PERFORM 1 FROM public.properties WHERE user_id = p_user_id FOR UPDATE;
        PERFORM 1 FROM public.cleaning_tasks WHERE property_id IN (
            SELECT id FROM public.properties WHERE user_id = p_user_id
        ) FOR UPDATE;
        PERFORM 1 FROM public.platform_documents WHERE user_id = p_user_id OR property_id IN (
            SELECT id FROM public.properties WHERE user_id = p_user_id
        ) FOR UPDATE;
        PERFORM 1 FROM public.team_members WHERE owner_id = p_user_id OR manager_id = p_user_id FOR UPDATE;
        PERFORM public.begin_account_deletion(p_user_id);
        IF EXISTS (SELECT 1 FROM public.account_deletion_objects(p_user_id)) THEN
            RAISE EXCEPTION 'Existem ficheiros por remover ou a eliminação não foi iniciada.' USING ERRCODE = '55000';
        END IF;
        DELETE FROM public.cleaning_task_photos WHERE property_id::text IN (
            SELECT id::text FROM public.properties WHERE user_id = p_user_id
        ) OR task_id IN (
            SELECT task.id FROM public.cleaning_tasks AS task JOIN public.properties AS property ON property.id = task.property_id
            WHERE property.user_id = p_user_id
        );
        DELETE FROM public.cleaning_photos WHERE task_id IN (
            SELECT task.id FROM public.cleaning_tasks AS task JOIN public.properties AS property ON property.id = task.property_id
            WHERE property.user_id = p_user_id
        );
        DELETE FROM public.property_incidents WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id);
        DELETE FROM public.work_time_entries WHERE owner_id = p_user_id OR property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id);
        DELETE FROM public.property_financial_entries AS entry WHERE user_id = p_user_id OR property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id)
            OR platform_document_id IN (SELECT id FROM public.platform_documents WHERE user_id = p_user_id)
            OR to_jsonb(entry)->>'document_id' IN (SELECT id::text FROM public.platform_documents WHERE user_id = p_user_id);
        DELETE FROM public.hosting_reports AS report WHERE to_jsonb(report)->>'uploaded_by' = p_user_id::text
            OR property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id);
        DELETE FROM public.platform_documents WHERE user_id = p_user_id OR property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id);
        DELETE FROM public.cleaning_tasks WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = p_user_id);
        DELETE FROM public.properties WHERE user_id = p_user_id;
        DELETE FROM public.team_members WHERE owner_id = p_user_id OR manager_id = p_user_id;
    ELSE
        PERFORM 1 FROM public.team_members WHERE auth_user_id = p_user_id FOR UPDATE;
        PERFORM public.begin_account_deletion(p_user_id);
        IF EXISTS (SELECT 1 FROM public.properties WHERE user_id = p_user_id)
           OR EXISTS (SELECT 1 FROM public.team_members WHERE owner_id = p_user_id OR manager_id = p_user_id) THEN
            RAISE EXCEPTION 'A conta possui dados de gestão e requer revisão.' USING ERRCODE = '55000';
        END IF;
        UPDATE public.properties SET assigned_team_member_id = NULL WHERE assigned_team_member_id IN (
            SELECT id FROM public.team_members WHERE auth_user_id = p_user_id
        );
        UPDATE public.team_members SET accepted_invite_user_id = NULL WHERE accepted_invite_user_id = p_user_id
            AND auth_user_id IS DISTINCT FROM p_user_id;
        DELETE FROM public.team_members WHERE auth_user_id = p_user_id;
    END IF;
    DELETE FROM public.profiles WHERE id = p_user_id;
    FOR dependency IN
        SELECT ns.nspname, rel.relname, attr.attname, constraint_def.conname,
               cardinality(constraint_def.conkey) AS key_count
        FROM pg_catalog.pg_constraint AS constraint_def
        JOIN pg_catalog.pg_class AS rel ON rel.oid = constraint_def.conrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = rel.relnamespace
        JOIN pg_catalog.pg_attribute AS attr ON attr.attrelid = rel.oid AND attr.attnum = constraint_def.conkey[1]
        WHERE constraint_def.contype = 'f' AND constraint_def.confrelid = 'auth.users'::regclass
          AND ns.nspname <> 'auth' AND constraint_def.confdeltype IN ('c', 'n', 'd')
    LOOP
        IF dependency.key_count <> 1 THEN
            RAISE EXCEPTION 'Dependência composta da conta requer revisão: %', dependency.conname;
        END IF;
        EXECUTE pg_catalog.format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I::text = $1::text)',
            dependency.nspname, dependency.relname, dependency.attname)
            INTO has_rows USING p_user_id;
        IF has_rows THEN RAISE EXCEPTION 'Dependência da conta requer revisão: %', dependency.conname; END IF;
    END LOOP;
    DELETE FROM auth.users WHERE id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Utilizador não encontrado.' USING ERRCODE = '55000'; END IF;
    IF account_role = 'admin' THEN
        INSERT INTO public.account_deletion_tombstones (user_id) VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    DELETE FROM public.account_deletion_jobs WHERE user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_account_deletion(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_account_deletion(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
