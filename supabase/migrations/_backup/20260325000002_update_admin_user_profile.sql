-- Migration: Backfill missing public user profiles for existing auth users
-- Problem: Users created via Supabase dashboard or before the handle_new_user
-- trigger was added have no row in public.users, causing auth.user_org_id()
-- to return NULL and RLS to block all queries.
-- This migration creates profiles for ALL auth users that are missing one.
-- The FIRST missing user is assigned 'admin' role; subsequent ones get 'staff'.

DO $$
DECLARE
  v_org_id UUID;
  v_auth_user RECORD;
  v_is_first BOOLEAN := TRUE;
  v_full_name TEXT;
  v_role TEXT;
BEGIN
  -- Get the single organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping backfill';
    RETURN;
  END IF;

  -- Loop through auth users without a public profile
  FOR v_auth_user IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.id IS NULL
    ORDER BY au.created_at ASC
  LOOP
    v_full_name := COALESCE(
      v_auth_user.raw_user_meta_data ->> 'full_name',
      v_auth_user.raw_user_meta_data ->> 'name',
      split_part(v_auth_user.email, '@', 1)
    );

    -- First missing user gets admin role (likely the platform creator)
    IF v_is_first THEN
      v_role := 'admin';
      v_is_first := FALSE;
    ELSE
      v_role := 'staff';
    END IF;

    INSERT INTO public.users (id, org_id, email, full_name, role, is_active)
    VALUES (v_auth_user.id, v_org_id, v_auth_user.email, v_full_name, v_role::user_role, TRUE)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created profile for % (%) as %', v_full_name, v_auth_user.email, v_role;
  END LOOP;
END $$;

-- Also fix any existing users that have NULL org_id
UPDATE public.users
SET org_id = (SELECT id FROM organizations LIMIT 1)
WHERE org_id IS NULL
  AND (SELECT id FROM organizations LIMIT 1) IS NOT NULL;
