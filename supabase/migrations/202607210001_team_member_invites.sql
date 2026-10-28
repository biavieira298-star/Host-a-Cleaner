CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS invite_token_hash text,
    ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS track_hours boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS require_photos boolean NOT NULL DEFAULT false;

ALTER TABLE public.team_members ALTER COLUMN email DROP NOT NULL;

UPDATE public.team_members
SET auth_user_id = auth_user.id
FROM auth.users AS auth_user
WHERE team_members.auth_user_id IS NULL
  AND team_members.email IS NOT NULL
  AND lower(team_members.email) = lower(auth_user.email);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_members_manager_select ON public.team_members;
CREATE POLICY team_members_manager_select
    ON public.team_members FOR SELECT TO authenticated
    USING (manager_id = auth.uid() OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS team_members_manager_update ON public.team_members;
CREATE POLICY team_members_manager_update
    ON public.team_members FOR UPDATE TO authenticated
    USING (manager_id = auth.uid())
    WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS team_members_manager_delete ON public.team_members;
CREATE POLICY team_members_manager_delete
    ON public.team_members FOR DELETE TO authenticated
    USING (manager_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_team_member_invite(
    p_name text,
    p_phone text,
    p_track_hours boolean,
    p_require_photos boolean
)
RETURNS TABLE(member_id uuid, invite_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    generated_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    new_member_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF nullif(btrim(p_name), '') IS NULL
       OR length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 8 THEN
        RAISE EXCEPTION 'A member name and valid phone number are required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.team_members
        WHERE auth_user_id = auth.uid()
          AND role = 'cleaner'
    ) THEN
        RAISE EXCEPTION 'Only an administrator can create team invitations';
    END IF;

    INSERT INTO public.team_members (
        name, phone, role, track_hours, require_photos,
        manager_id, invite_token_hash, invite_expires_at
    )
    VALUES (
        btrim(p_name), p_phone, 'cleaner', coalesce(p_track_hours, false),
        coalesce(p_require_photos, false), auth.uid(),
        encode(digest(generated_token, 'sha256'), 'hex'),
        now() + interval '7 days'
    )
    RETURNING id INTO new_member_id;

    RETURN QUERY SELECT new_member_id, generated_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_team_member_invite(p_member_id uuid)
RETURNS TABLE(invite_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    generated_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.team_members
        WHERE auth_user_id = auth.uid()
          AND role = 'cleaner'
    ) THEN
        RAISE EXCEPTION 'Only an administrator can manage team invitations';
    END IF;

    UPDATE public.team_members
    SET invite_token_hash = encode(digest(generated_token, 'sha256'), 'hex'),
        invite_expires_at = now() + interval '7 days'
    WHERE id = p_member_id
      AND manager_id = auth.uid()
      AND auth_user_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found, already activated, or not managed by the current user';
    END IF;

    RETURN QUERY SELECT generated_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_member_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    submitted_token text := NEW.raw_user_meta_data ->> 'team_invite_token';
BEGIN
    IF submitted_token IS NULL OR submitted_token = '' THEN
        RETURN NEW;
    END IF;

    UPDATE public.team_members
    SET auth_user_id = NEW.id,
        email = NEW.email,
        invite_token_hash = NULL,
        invite_expires_at = NULL
    WHERE invite_token_hash = encode(digest(submitted_token, 'sha256'), 'hex')
      AND invite_expires_at > now()
      AND auth_user_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already used team invitation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_accept_team_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_team_invite
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.accept_team_member_invite();

REVOKE ALL ON FUNCTION public.create_team_member_invite(text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_member_invite(text, text, boolean, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.rotate_team_member_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_team_member_invite(uuid) TO authenticated;
