INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-documents', 'platform-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets SET public = false WHERE id = 'hosting-reports';

CREATE OR REPLACE FUNCTION public.protect_financial_profile_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF auth.role() IN ('authenticated', 'anon') THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'A remoção de perfis requer acesso privilegiado.'
                USING ERRCODE = '42501';
        END IF;
        IF (to_jsonb(NEW)->'can_view_financials') IS DISTINCT FROM (to_jsonb(OLD)->'can_view_financials')
           OR (to_jsonb(NEW)->'role') IS DISTINCT FROM (to_jsonb(OLD)->'role') THEN
            RAISE EXCEPTION 'A alteração de permissões de perfil requer acesso privilegiado.'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_financial_profile_permissions() FROM PUBLIC;
DROP TRIGGER IF EXISTS protect_financial_profile_permissions ON public.profiles;
CREATE TRIGGER protect_financial_profile_permissions
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_financial_profile_permissions();

CREATE OR REPLACE FUNCTION public.can_access_own_financial_storage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM public.team_members AS member
            WHERE member.auth_user_id = auth.uid()
              AND member.role::text IN ('cleaner', 'assistant', 'assistente')
        )
        AND EXISTS (
            SELECT 1
            FROM public.profiles AS profile
            WHERE profile.id = auth.uid()
              AND COALESCE((to_jsonb(profile)->>'can_view_financials')::boolean, true)
              AND COALESCE(to_jsonb(profile)->>'role', '') NOT IN ('cleaner', 'assistant', 'assistente')
              AND (
                  to_jsonb(profile)->>'role' = 'admin'
                  OR (
                      COALESCE(to_jsonb(profile)->>'role', '') <> 'admin'
                      AND COALESCE(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
                  )
                  OR (
                      COALESCE(to_jsonb(profile)->>'role', '') NOT IN ('admin', 'cleaner', 'assistant', 'assistente')
                      AND COALESCE(auth.jwt()->'app_metadata'->>'role', '') NOT IN ('admin', 'cleaner', 'assistant', 'assistente')
                      AND COALESCE(auth.jwt()->'user_metadata'->>'role', '') NOT IN ('cleaner', 'assistant', 'assistente')
                      AND EXISTS (
                          SELECT 1 FROM public.properties AS property
                          WHERE property.user_id = auth.uid()
                      )
                  )
              )
        );
$$;

REVOKE ALL ON FUNCTION public.can_access_own_financial_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_own_financial_storage() TO anon, authenticated;

DROP POLICY IF EXISTS financial_storage_restrict_access ON storage.objects;
CREATE POLICY financial_storage_restrict_access
    ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (
        bucket_id NOT IN ('platform-documents', 'hosting-reports')
        OR (
            public.can_access_own_financial_storage()
            AND (storage.foldername(name))[1] = auth.uid()::text
        )
    )
    WITH CHECK (
        bucket_id NOT IN ('platform-documents', 'hosting-reports')
        OR (
            public.can_access_own_financial_storage()
            AND (storage.foldername(name))[1] = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS platform_documents_storage_select ON storage.objects;
CREATE POLICY platform_documents_storage_select
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'platform-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.can_access_own_financial_storage()
    );

DROP POLICY IF EXISTS platform_documents_storage_insert ON storage.objects;
CREATE POLICY platform_documents_storage_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'platform-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.can_access_own_financial_storage()
    );

DROP POLICY IF EXISTS platform_documents_storage_delete ON storage.objects;
CREATE POLICY platform_documents_storage_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'platform-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.can_access_own_financial_storage()
    );
