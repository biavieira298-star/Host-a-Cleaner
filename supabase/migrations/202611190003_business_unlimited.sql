UPDATE public.profiles AS profile
SET max_properties = NULL,
    max_cleaners = NULL
WHERE lower(btrim(profile.subscription_plan)) = 'business'
  AND (profile.max_properties IS NOT NULL OR profile.max_cleaners IS NOT NULL)
  AND NOT EXISTS (
      SELECT 1 FROM public.account_deletion_jobs AS job WHERE job.user_id = profile.id
  );
