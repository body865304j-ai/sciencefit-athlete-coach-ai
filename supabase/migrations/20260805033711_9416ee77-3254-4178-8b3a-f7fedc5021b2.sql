REVOKE ALL ON public.workout_logs_default FROM authenticated, anon;
REVOKE ALL ON public.events_default FROM authenticated, anon;

CREATE POLICY "no direct partition access" ON public.workout_logs_default
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no direct partition access" ON public.events_default
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM authenticated, anon, public;