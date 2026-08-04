ALTER TABLE public.audit_logs_default ENABLE ROW LEVEL SECURITY;

-- Trigger-only functions must never be callable through the Data API.
REVOKE ALL ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_deadline_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_program_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_evaluation_immutable() FROM PUBLIC, anon, authenticated;

-- has_role is intentionally callable by signed-in users: RLS policies invoke it
-- as the caller. It is read-only and takes an explicit user id, so it leaks
-- nothing beyond what user_roles policies already allow.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;