-- Grant service_role permissions required by Next.js server routes & APIs
-- when public.branch_users was created manually via Supabase SQL Editor.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branch_users TO service_role;

-- Ensure RLS is enabled on branch_users (service_role bypasses RLS by default,
-- while anon/authenticated remain denied direct table access).
ALTER TABLE public.branch_users ENABLE ROW LEVEL SECURITY;

-- If audit_logs.action has a check constraint, extend it safely with staff lifecycle actions.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'audit_logs'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%action%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', constraint_name);
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_action_check
      CHECK (
        action IN (
          'CREATE_ENTRY',
          'EDIT_ENTRY',
          'DELETE_ENTRY',
          'APPROVE_ENTRY',
          'FLAG_ENTRY',
          'OWNER_LOGIN',
          'LOGIN_SUCCESS',
          'LOGIN_BLOCKED_MOBILE',
          'LOGIN_BLOCKED_MAX_DEVICES',
          'DEVICE_APPROVED',
          'DEVICE_REVOKED',
          'BOOK_CREATED',
          'BOOK_UPDATED',
          'BRANCH_UPDATED',
          'STAFF_ACCOUNT_CREATED',
          'STAFF_ACCESS_REVOKED',
          'STAFF_ACCESS_RESTORED',
          'STAFF_PASSWORD_RESET',
          'STAFF_ACCOUNT_DELETED'
        )
      );
  END IF;
END $$;
