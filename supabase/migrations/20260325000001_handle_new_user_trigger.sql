-- Migration: Auto-create public user profile when a new auth user is created

-- This trigger fires when a new user signs up (or is created via admin API).
-- It creates a corresponding row in public.users so that RLS helper functions
-- (auth.user_org_id, auth.user_role) work correctly from the first login.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  -- Get full_name from user metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  -- Single-tenant: use the first (and only) organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  -- Create public user profile (skip if already exists)
  INSERT INTO public.users (id, org_id, email, full_name, role, is_active)
  VALUES (NEW.id, v_org_id, NEW.email, v_full_name, 'staff', TRUE)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
