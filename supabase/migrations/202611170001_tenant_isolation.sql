BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS invite_token_hash text,
    ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS track_hours boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS require_photos boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS accepted_invite_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS assigned_team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.cleaning_tasks
    ADD COLUMN IF NOT EXISTS assigned_team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.work_time_entries
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid = 'public.work_time_entries'::regclass
          AND attname = 'team_member_id' AND attnotnull AND NOT attisdropped
    ) THEN
        ALTER TABLE public.work_time_entries ALTER COLUMN team_member_id DROP NOT NULL;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_team_member_invite(
    p_name text, p_phone text, p_track_hours boolean, p_require_photos boolean
)
RETURNS TABLE(member_id uuid, invite_token text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    generated_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    new_member_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id::text = auth.uid()::text AND (role::text = 'admin' OR subscription_plan::text = 'admin')
    ) THEN
        RAISE EXCEPTION 'Only an administrator can create team invitations';
    END IF;
    IF nullif(btrim(p_name), '') IS NULL
       OR length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 8 THEN
        RAISE EXCEPTION 'A member name and valid phone number are required';
    END IF;
    INSERT INTO public.team_members (
        name, phone, role, track_hours, require_photos,
        owner_id, invite_token_hash, invite_expires_at
    ) VALUES (
        btrim(p_name), p_phone, 'cleaner', coalesce(p_track_hours, false),
        coalesce(p_require_photos, false), auth.uid(),
        encode(digest(generated_token, 'sha256'), 'hex'), now() + interval '7 days'
    ) RETURNING id::uuid INTO new_member_id;
    RETURN QUERY SELECT new_member_id, generated_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_team_member_invite(p_member_id uuid)
RETURNS TABLE(invite_token text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    generated_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id::text = auth.uid()::text AND (role::text = 'admin' OR subscription_plan::text = 'admin')
    ) THEN
        RAISE EXCEPTION 'Only an administrator can manage team invitations';
    END IF;
    UPDATE public.team_members
    SET invite_token_hash = encode(digest(generated_token, 'sha256'), 'hex'),
        invite_expires_at = now() + interval '7 days'
    WHERE id::text = p_member_id::text AND owner_id::text = auth.uid()::text AND auth_user_id IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found, already activated, or not managed by the current user';
    END IF;
    RETURN QUERY SELECT generated_token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_team_member_invite(text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_member_invite(text, text, boolean, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.rotate_team_member_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_team_member_invite(uuid) TO authenticated;

-- An invalid invitation must never link the account to a team.
CREATE OR REPLACE FUNCTION public.accept_team_member_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    submitted_token text := NEW.raw_user_meta_data ->> 'team_invite_token';
BEGIN
    IF nullif(submitted_token, '') IS NOT NULL THEN
        UPDATE public.team_members
        SET auth_user_id = NEW.id,
            email = NEW.email,
            accepted_invite_user_id = NEW.id,
            invite_token_hash = NULL,
            invite_expires_at = NULL
        WHERE invite_token_hash = encode(digest(submitted_token, 'sha256'), 'hex')
          AND invite_expires_at > now()
          AND auth_user_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_accept_team_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_team_invite
    AFTER INSERT ON auth.users FOR EACH ROW
    EXECUTE FUNCTION public.accept_team_member_invite();

-- Only privileged server-side functions may change account permissions.
CREATE OR REPLACE FUNCTION public.protect_financial_profile_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF auth.role() IN ('authenticated', 'anon') AND current_user IN ('authenticated', 'anon') THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'A remoção de perfis requer acesso privilegiado.' USING ERRCODE = '42501';
        END IF;
        IF (to_jsonb(NEW)->'can_view_financials') IS DISTINCT FROM (to_jsonb(OLD)->'can_view_financials')
           OR (to_jsonb(NEW)->'role') IS DISTINCT FROM (to_jsonb(OLD)->'role')
           OR (to_jsonb(NEW)->'subscription_plan') IS DISTINCT FROM (to_jsonb(OLD)->'subscription_plan')
           OR (to_jsonb(NEW)->'max_properties') IS DISTINCT FROM (to_jsonb(OLD)->'max_properties')
           OR (to_jsonb(NEW)->'max_cleaners') IS DISTINCT FROM (to_jsonb(OLD)->'max_cleaners') THEN
            RAISE EXCEPTION 'A alteração de permissões de perfil requer acesso privilegiado.' USING ERRCODE = '42501';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_financial_profile_permissions ON public.profiles;
CREATE TRIGGER protect_financial_profile_permissions
    BEFORE UPDATE OR DELETE ON public.profiles FOR EACH ROW
    EXECUTE FUNCTION public.protect_financial_profile_permissions();

CREATE OR REPLACE FUNCTION public.initialize_tenant_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    invited boolean;
BEGIN
    UPDATE public.team_members
    SET auth_user_id = NULL
    WHERE auth_user_id::text = NEW.id::text
      AND accepted_invite_user_id::text IS DISTINCT FROM NEW.id::text;

    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE auth_user_id::text = NEW.id::text AND accepted_invite_user_id::text = NEW.id::text AND role = 'cleaner'
    ) INTO invited;

    IF invited THEN
        INSERT INTO public.profiles (id, role, subscription_plan, max_properties, max_cleaners)
        VALUES (NEW.id, 'cleaner', 'free', 1, 1)
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role, subscription_plan = EXCLUDED.subscription_plan,
            max_properties = EXCLUDED.max_properties, max_cleaners = EXCLUDED.max_cleaners;
    ELSE
        INSERT INTO public.profiles (id, role, subscription_plan, max_properties, max_cleaners)
        VALUES (NEW.id, 'admin', 'free', 1, 1)
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role, subscription_plan = EXCLUDED.subscription_plan,
            max_properties = EXCLUDED.max_properties, max_cleaners = EXCLUDED.max_cleaners;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_tenant_profile() FROM PUBLIC;
DROP TRIGGER IF EXISTS zzz_initialize_tenant_profile ON auth.users;
CREATE TRIGGER zzz_initialize_tenant_profile
    AFTER INSERT ON auth.users FOR EACH ROW
    EXECUTE FUNCTION public.initialize_tenant_profile();

CREATE OR REPLACE FUNCTION public.protect_team_membership_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF auth.role() IN ('authenticated', 'anon') AND current_user IN ('authenticated', 'anon')
       AND (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
            OR NEW.accepted_invite_user_id IS DISTINCT FROM OLD.accepted_invite_user_id
            OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
            OR NEW.role IS DISTINCT FROM OLD.role
            OR NEW.invite_token_hash IS DISTINCT FROM OLD.invite_token_hash
            OR NEW.invite_expires_at IS DISTINCT FROM OLD.invite_expires_at) THEN
        RAISE EXCEPTION 'A associação à equipa requer um convite válido.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_team_membership_links() FROM PUBLIC;
DROP TRIGGER IF EXISTS protect_team_membership_links ON public.team_members;
CREATE TRIGGER protect_team_membership_links BEFORE UPDATE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION public.protect_team_membership_links();

CREATE OR REPLACE FUNCTION public.validate_tenant_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_owner_id text;
BEGIN
    IF NEW.assigned_team_member_id IS NULL THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'properties' THEN
        v_owner_id := NEW.user_id::text;
    ELSE
        SELECT user_id::text INTO v_owner_id FROM public.properties WHERE id::text = NEW.property_id::text;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE id::text = NEW.assigned_team_member_id::text AND owner_id::text = v_owner_id AND role = 'cleaner'
    ) THEN
        RAISE EXCEPTION 'A atribuição tem de pertencer à equipa do proprietário.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_tenant_assignment() FROM PUBLIC;
DROP TRIGGER IF EXISTS validate_property_tenant_assignment ON public.properties;
CREATE TRIGGER validate_property_tenant_assignment BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_assignment();
DROP TRIGGER IF EXISTS validate_task_tenant_assignment ON public.cleaning_tasks;
CREATE TRIGGER validate_task_tenant_assignment BEFORE INSERT OR UPDATE ON public.cleaning_tasks
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_assignment();

CREATE OR REPLACE FUNCTION public.tenant_can_read_owner_team(p_owner_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.team_members AS member
        JOIN public.profiles AS profile ON profile.id::text = member.auth_user_id::text
        WHERE member.owner_id::text = p_owner_id
          AND member.auth_user_id::text = auth.uid()::text
          AND member.role = 'cleaner'
          AND profile.role::text = 'cleaner'
          AND coalesce(profile.subscription_plan::text, '') <> 'admin'
    );
$$;
REVOKE ALL ON FUNCTION public.tenant_can_read_owner_team(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_read_owner_team(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tenant_can_access_documents()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.team_members AS member
          WHERE member.auth_user_id::text = auth.uid()::text
            AND member.role::text = 'cleaner'
      )
      AND EXISTS (
          SELECT 1 FROM public.profiles AS profile
          WHERE profile.id::text = auth.uid()::text
            AND coalesce((to_jsonb(profile)->>'can_view_financials')::boolean, true)
            AND (profile.role::text = 'admin' OR profile.subscription_plan::text = 'admin')
      );
$$;
REVOKE ALL ON FUNCTION public.tenant_can_access_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_access_documents() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tenant_can_read_property(p_property_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.properties AS property
        WHERE property.id::text = p_property_id
          AND (
              property.user_id::text = auth.uid()::text
              OR EXISTS (
                  SELECT 1 FROM public.team_members AS member
                  JOIN public.profiles AS profile ON profile.id::text = member.auth_user_id::text
                  WHERE member.id::text = property.assigned_team_member_id::text
                    AND member.owner_id::text = property.user_id::text
                    AND member.auth_user_id::text = auth.uid()::text
                    AND member.role = 'cleaner'
                    AND profile.role::text = 'cleaner'
                    AND coalesce(profile.subscription_plan::text, '') <> 'admin'
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.tenant_can_read_task(p_property_id text, p_member_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.properties AS property
        WHERE property.id::text = p_property_id
          AND (
              property.user_id::text = auth.uid()::text
              OR EXISTS (
                  SELECT 1 FROM public.team_members AS member
                  JOIN public.profiles AS profile ON profile.id::text = member.auth_user_id::text
                  WHERE member.id::text = p_member_id
                    AND member.owner_id::text = property.user_id::text
                    AND member.auth_user_id::text = auth.uid()::text
                    AND member.role = 'cleaner'
                    AND profile.role::text = 'cleaner'
                    AND coalesce(profile.subscription_plan::text, '') <> 'admin'
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.tenant_can_read_property(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tenant_can_read_task(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_read_property(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_can_read_task(text, text) TO anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_documents ENABLE ROW LEVEL SECURITY;

-- Remove only the policies created by this migration, including after a partial run.
DO $$
DECLARE
    policy record;
BEGIN
    FOR policy IN
        SELECT * FROM (VALUES
            ('public', 'profiles', 'tenant_profiles_read'),
            ('public', 'team_members', 'tenant_members_read'),
            ('public', 'properties', 'tenant_properties_read'),
            ('public', 'cleaning_tasks', 'tenant_tasks_read'),
            ('public', 'cleaning_task_photos', 'tenant_photos_read'),
            ('public', 'property_incidents', 'tenant_incidents_read'),
            ('public', 'work_time_entries', 'tenant_hours_read'),
            ('public', 'property_financial_entries', 'tenant_finances_read'),
            ('public', 'platform_documents', 'tenant_documents_read'),
            ('public', 'profiles', 'tenant_profiles_select'),
            ('public', 'team_members', 'tenant_members_select'),
            ('public', 'team_members', 'tenant_members_owner_update'),
            ('public', 'team_members', 'tenant_members_owner_delete'),
            ('public', 'work_time_entries', 'tenant_hours_select'),
            ('public', 'work_time_entries', 'tenant_hours_insert_self'),
            ('public', 'property_incidents', 'tenant_incidents_owner_update'),
            ('public', 'cleaning_tasks', 'tenant_tasks_select'),
            ('public', 'platform_documents', 'tenant_documents_select'),
            ('public', 'platform_documents', 'tenant_documents_insert'),
            ('public', 'platform_documents', 'tenant_documents_delete'),
            ('public', 'profiles', 'tenant_profiles_write'),
            ('public', 'profiles', 'tenant_profiles_no_client_insert'),
            ('public', 'team_members', 'tenant_members_insert'),
            ('public', 'team_members', 'tenant_members_update'),
            ('public', 'team_members', 'tenant_members_delete'),
            ('public', 'properties', 'tenant_properties_insert'),
            ('public', 'properties', 'tenant_properties_update'),
            ('public', 'properties', 'tenant_properties_delete'),
            ('public', 'cleaning_tasks', 'tenant_tasks_insert'),
            ('public', 'cleaning_tasks', 'tenant_tasks_update'),
            ('public', 'cleaning_tasks', 'tenant_tasks_delete'),
            ('public', 'property_financial_entries', 'tenant_finances_write'),
            ('public', 'platform_documents', 'tenant_documents_write'),
            ('public', 'work_time_entries', 'tenant_hours_write'),
            ('public', 'cleaning_task_photos', 'tenant_photos_insert'),
            ('public', 'cleaning_task_photos', 'tenant_photos_update'),
            ('public', 'cleaning_task_photos', 'tenant_photos_delete'),
            ('public', 'property_incidents', 'tenant_incidents_insert'),
            ('public', 'property_incidents', 'tenant_incidents_update'),
            ('public', 'property_incidents', 'tenant_incidents_delete'),
            ('storage', 'objects', 'tenant_photo_storage_read'),
            ('storage', 'objects', 'tenant_photo_storage_select'),
            ('storage', 'objects', 'tenant_document_storage_isolation'),
            ('storage', 'objects', 'tenant_document_storage_select'),
            ('storage', 'objects', 'tenant_document_storage_insert'),
            ('storage', 'objects', 'tenant_document_storage_delete')
        ) AS p(schema_name, table_name, policy_name)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            policy.policy_name, policy.schema_name, policy.table_name);
    END LOOP;
END;
$$;

-- Restrictive policies also constrain any pre-existing permissive policies.
CREATE POLICY tenant_profiles_read ON public.profiles AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (id::text = auth.uid()::text);
CREATE POLICY tenant_members_read ON public.team_members AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (
        owner_id::text = auth.uid()::text OR public.tenant_can_read_owner_team(owner_id::text)
    );
CREATE POLICY tenant_properties_read ON public.properties AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (public.tenant_can_read_property(id::text));
CREATE POLICY tenant_tasks_read ON public.cleaning_tasks AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (public.tenant_can_read_task(property_id::text, assigned_team_member_id::text));
CREATE POLICY tenant_photos_read ON public.cleaning_task_photos AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (EXISTS (
        SELECT 1 FROM public.cleaning_tasks AS task
        WHERE task.id::text = cleaning_task_photos.task_id::text
          AND task.property_id::text = cleaning_task_photos.property_id::text
          AND public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
    ));
CREATE POLICY tenant_incidents_read ON public.property_incidents AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_hours_read ON public.work_time_entries AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (owner_id::text = auth.uid()::text OR user_id::text = auth.uid()::text);
CREATE POLICY tenant_finances_read ON public.property_financial_entries AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (user_id::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_documents_read ON public.platform_documents AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (user_id::text = auth.uid()::text AND public.tenant_can_access_documents());

CREATE POLICY tenant_profiles_select ON public.profiles FOR SELECT TO authenticated
    USING (id::text = auth.uid()::text);
CREATE POLICY tenant_members_select ON public.team_members FOR SELECT TO authenticated
    USING (owner_id::text = auth.uid()::text OR public.tenant_can_read_owner_team(owner_id::text));
CREATE POLICY tenant_members_owner_update ON public.team_members FOR UPDATE TO authenticated
    USING (owner_id::text = auth.uid()::text) WITH CHECK (owner_id::text = auth.uid()::text);
CREATE POLICY tenant_members_owner_delete ON public.team_members FOR DELETE TO authenticated
    USING (owner_id::text = auth.uid()::text);
CREATE POLICY tenant_hours_select ON public.work_time_entries FOR SELECT TO authenticated
    USING (owner_id::text = auth.uid()::text OR user_id::text = auth.uid()::text);
CREATE POLICY tenant_hours_insert_self ON public.work_time_entries FOR INSERT TO authenticated
    WITH CHECK (
        user_id::text = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.team_members AS member
            WHERE member.auth_user_id::text = work_time_entries.user_id::text
              AND member.owner_id::text = work_time_entries.owner_id::text
              AND member.role::text = 'cleaner'
              AND (work_time_entries.property_id IS NULL OR EXISTS (
                  SELECT 1 FROM public.properties AS property
                  WHERE property.id::text = work_time_entries.property_id::text
                    AND property.user_id::text = work_time_entries.owner_id::text
                    AND property.assigned_team_member_id::text = member.id::text
              ))
              AND (to_jsonb(work_time_entries)->>'task_id' IS NULL OR EXISTS (
                  SELECT 1 FROM public.cleaning_tasks AS task
                  WHERE task.id::text = to_jsonb(work_time_entries)->>'task_id'
                    AND task.assigned_team_member_id::text = member.id::text
                    AND (work_time_entries.property_id IS NULL OR task.property_id::text = work_time_entries.property_id::text)
              ))
        )
    );
CREATE POLICY tenant_incidents_owner_update ON public.property_incidents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.properties WHERE id::text = property_incidents.property_id::text AND user_id::text = auth.uid()::text))
    WITH CHECK (EXISTS (SELECT 1 FROM public.properties WHERE id::text = property_incidents.property_id::text AND user_id::text = auth.uid()::text));
GRANT SELECT, INSERT ON public.work_time_entries TO authenticated;
CREATE POLICY tenant_tasks_select ON public.cleaning_tasks FOR SELECT TO authenticated
    USING (public.tenant_can_read_task(property_id::text, assigned_team_member_id::text));
CREATE POLICY tenant_documents_select ON public.platform_documents FOR SELECT TO authenticated
    USING (user_id::text = auth.uid()::text);
CREATE POLICY tenant_documents_insert ON public.platform_documents FOR INSERT TO authenticated
    WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY tenant_documents_delete ON public.platform_documents FOR DELETE TO authenticated
    USING (user_id::text = auth.uid()::text);

CREATE POLICY tenant_profiles_write ON public.profiles AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (id::text = auth.uid()::text) WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY tenant_profiles_no_client_insert ON public.profiles AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (false);
CREATE POLICY tenant_members_insert ON public.team_members AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (owner_id::text = auth.uid()::text AND auth_user_id IS NULL AND accepted_invite_user_id IS NULL
        AND invite_token_hash IS NULL AND invite_expires_at IS NULL);
CREATE POLICY tenant_members_update ON public.team_members AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (owner_id::text = auth.uid()::text) WITH CHECK (owner_id::text = auth.uid()::text);
CREATE POLICY tenant_members_delete ON public.team_members AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (owner_id::text = auth.uid()::text);
CREATE POLICY tenant_properties_insert ON public.properties AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY tenant_properties_update ON public.properties AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (user_id::text = auth.uid()::text) WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY tenant_properties_delete ON public.properties AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (user_id::text = auth.uid()::text);
CREATE POLICY tenant_tasks_insert ON public.cleaning_tasks AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (EXISTS (SELECT 1 FROM public.properties WHERE id::text = cleaning_tasks.property_id::text AND user_id::text = auth.uid()::text));
CREATE POLICY tenant_tasks_update ON public.cleaning_tasks AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (public.tenant_can_read_task(property_id::text, assigned_team_member_id::text))
    WITH CHECK (public.tenant_can_read_task(property_id::text, assigned_team_member_id::text));
CREATE POLICY tenant_tasks_delete ON public.cleaning_tasks AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (EXISTS (SELECT 1 FROM public.properties WHERE id::text = cleaning_tasks.property_id::text AND user_id::text = auth.uid()::text));
CREATE POLICY tenant_finances_write ON public.property_financial_entries AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text AND EXISTS (
        SELECT 1 FROM public.properties WHERE id::text = property_financial_entries.property_id::text AND user_id::text = auth.uid()::text
    ));
CREATE POLICY tenant_documents_write ON public.platform_documents AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (user_id::text = auth.uid()::text AND public.tenant_can_access_documents()) WITH CHECK (
        user_id::text = auth.uid()::text AND public.tenant_can_access_documents() AND (property_id IS NULL OR EXISTS (
            SELECT 1 FROM public.properties WHERE id::text = platform_documents.property_id::text AND user_id::text = auth.uid()::text
        ))
    );
CREATE POLICY tenant_hours_write ON public.work_time_entries AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (owner_id::text = auth.uid()::text OR user_id::text = auth.uid()::text)
    WITH CHECK (
        (owner_id::text = auth.uid()::text OR user_id::text = auth.uid()::text)
        AND EXISTS (
            SELECT 1 FROM public.team_members AS member
            WHERE member.auth_user_id::text = work_time_entries.user_id::text
              AND member.owner_id::text = work_time_entries.owner_id::text
        )
        AND (
            property_id IS NULL OR EXISTS (
                SELECT 1 FROM public.properties AS property
                WHERE property.id::text = work_time_entries.property_id::text
                  AND property.user_id::text = work_time_entries.owner_id::text
            )
        )
    );

CREATE POLICY tenant_photos_insert ON public.cleaning_task_photos AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (uploaded_by::text = auth.uid()::text AND EXISTS (
        SELECT 1 FROM public.cleaning_tasks AS task
        WHERE task.id::text = cleaning_task_photos.task_id::text
          AND task.property_id::text = cleaning_task_photos.property_id::text
          AND public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
    ));
CREATE POLICY tenant_photos_update ON public.cleaning_task_photos AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (uploaded_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text))
    WITH CHECK (uploaded_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_photos_delete ON public.cleaning_task_photos AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (uploaded_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_insert ON public.property_incidents AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (created_by::text = auth.uid()::text AND public.tenant_can_read_property(property_id::text));
CREATE POLICY tenant_incidents_update ON public.property_incidents AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (EXISTS (SELECT 1 FROM public.properties WHERE id::text = property_incidents.property_id::text AND user_id::text = auth.uid()::text))
    WITH CHECK (EXISTS (SELECT 1 FROM public.properties WHERE id::text = property_incidents.property_id::text AND user_id::text = auth.uid()::text));
CREATE POLICY tenant_incidents_delete ON public.property_incidents AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (EXISTS (SELECT 1 FROM public.properties WHERE id::text = property_incidents.property_id::text AND user_id::text = auth.uid()::text));

CREATE OR REPLACE FUNCTION public.tenant_can_read_photo(p_bucket text, p_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_bucket = 'cleaning-photos' THEN
            EXISTS (
                SELECT 1 FROM public.cleaning_tasks AS task
                WHERE task.id::text = split_part(p_path, '/', 3)
                  AND task.property_id::text = split_part(p_path, '/', 2)
                  AND public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
            )
            OR EXISTS (
                SELECT 1 FROM public.cleaning_task_photos AS photo
                JOIN public.cleaning_tasks AS task ON task.id::text = photo.task_id::text AND task.property_id::text = photo.property_id::text
                WHERE photo.storage_path = p_path
                  AND split_part(p_path, '/', 1) = photo.uploaded_by::text
                  AND public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
            )
            OR EXISTS (
                SELECT 1 FROM public.cleaning_tasks AS task
                JOIN public.properties AS property ON property.id::text = task.property_id::text
                LEFT JOIN public.team_members AS member
                    ON member.id::text = task.assigned_team_member_id::text AND member.owner_id::text = property.user_id::text
                WHERE public.tenant_can_read_task(task.property_id::text, task.assigned_team_member_id::text)
                  AND split_part(p_path, '/', 1) IN (property.user_id::text, member.auth_user_id::text)
                  AND EXISTS (
                      SELECT 1 FROM unnest(ARRAY[
                          to_jsonb(task)->>'photo_before_url', to_jsonb(task)->>'photo_after_url'
                      ]) AS photo(url)
                      WHERE right(photo.url, length('/storage/v1/object/public/cleaning-photos/' || p_path))
                            = '/storage/v1/object/public/cleaning-photos/' || p_path
                  )
            )
            OR EXISTS (
                SELECT 1 FROM public.property_incidents AS incident
                WHERE incident.created_by::text = split_part(p_path, '/', 1)
                  AND public.tenant_can_read_property(incident.property_id::text)
                  AND EXISTS (
                      SELECT 1 FROM unnest(coalesce(incident.photos, ARRAY[]::text[]) || ARRAY[incident.photo_url]) AS photo(url)
                      WHERE right(photo.url, length('/storage/v1/object/public/cleaning-photos/' || p_path))
                            = '/storage/v1/object/public/cleaning-photos/' || p_path
                  )
            )
        WHEN p_bucket = 'property-incidents' THEN EXISTS (
            SELECT 1 FROM public.properties AS property
            WHERE property.id::text = split_part(p_path, '/', 2)
              AND public.tenant_can_read_property(property.id::text)
        )
        ELSE false
    END;
$$;
REVOKE ALL ON FUNCTION public.tenant_can_read_photo(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_read_photo(text, text) TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-documents', 'platform-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;
UPDATE storage.buckets SET public = false WHERE id IN ('cleaning-photos', 'property-incidents');
CREATE POLICY tenant_document_storage_isolation ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (bucket_id <> 'platform-documents' OR (
        public.tenant_can_access_documents() AND split_part(name, '/', 1) = auth.uid()::text
    ))
    WITH CHECK (bucket_id <> 'platform-documents' OR (
        public.tenant_can_access_documents() AND split_part(name, '/', 1) = auth.uid()::text
    ));
CREATE POLICY tenant_document_storage_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'platform-documents' AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY tenant_document_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'platform-documents' AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY tenant_document_storage_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'platform-documents' AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY tenant_photo_storage_read ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
    USING (
        bucket_id NOT IN ('cleaning-photos', 'property-incidents')
        OR public.tenant_can_read_photo(bucket_id, name)
    );
CREATE POLICY tenant_photo_storage_select ON storage.objects FOR SELECT TO authenticated
    USING (public.tenant_can_read_photo(bucket_id, name));

NOTIFY pgrst, 'reload schema';
COMMIT;
