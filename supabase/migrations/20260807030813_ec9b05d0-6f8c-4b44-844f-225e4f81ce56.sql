REVOKE EXECUTE ON FUNCTION public.owns_athlete(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_coach(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.in_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_athlete(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_coach(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.in_conversation(uuid) TO authenticated, service_role;