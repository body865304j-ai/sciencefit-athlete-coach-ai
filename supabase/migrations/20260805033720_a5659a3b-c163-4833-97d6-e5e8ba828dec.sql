CREATE POLICY "no direct partition access" ON public.audit_logs_default
  FOR ALL TO authenticated USING (false) WITH CHECK (false);