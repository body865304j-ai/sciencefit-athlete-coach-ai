-- ============================================================
-- user_preferences (Users module)
-- ============================================================
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'UTC',
  units text NOT NULL DEFAULT 'metric',
  device_tier_preference text,
  reduced_motion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_preferences_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- workout_logs (Athletes module) — partitioned by session date
-- ============================================================
CREATE TABLE public.workout_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  perceived_exertion smallint,
  duration_minutes smallint,
  athlete_notes text,
  client_generated_id text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, session_date)
) PARTITION BY RANGE (session_date);

CREATE TABLE public.workout_logs_default PARTITION OF public.workout_logs DEFAULT;

CREATE INDEX workout_logs_athlete_idx ON public.workout_logs (athlete_id, session_date DESC);
CREATE UNIQUE INDEX workout_logs_client_id_idx
  ON public.workout_logs (athlete_id, client_generated_id, session_date)
  WHERE client_generated_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs_default TO authenticated;
GRANT ALL ON public.workout_logs_default TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete owns workout logs" ON public.workout_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = workout_logs.athlete_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = workout_logs.athlete_id AND a.user_id = auth.uid()));
CREATE TRIGGER workout_logs_set_updated_at BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- coach_performance_scores (Coaches module)
-- ============================================================
CREATE TABLE public.coach_performance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL,
  previous_score numeric,
  base_score numeric NOT NULL,
  trend_bonus numeric NOT NULL,
  consistency_bonus numeric NOT NULL,
  volume_penalty numeric NOT NULL,
  performance_score numeric NOT NULL,
  submissions_counted smallint NOT NULL,
  computation_snapshot jsonb NOT NULL,
  criteria_version_id uuid REFERENCES public.evaluation_criteria_versions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_performance_scores_coach_idx ON public.coach_performance_scores (coach_id, created_at DESC);
GRANT SELECT ON public.coach_performance_scores TO authenticated;
GRANT ALL ON public.coach_performance_scores TO service_role;
ALTER TABLE public.coach_performance_scores ENABLE ROW LEVEL SECURITY;
-- Performance Score is public merit information (Business Protocol 11 / 14).
CREATE POLICY "score history readable by authenticated" ON public.coach_performance_scores
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER coach_performance_scores_audit AFTER INSERT OR UPDATE OR DELETE ON public.coach_performance_scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- notifications (Notifications module)
-- ============================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  title text NOT NULL,
  body text NOT NULL,
  link_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications readable" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications markable" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- notification_preferences (Notifications module)
-- ============================================================
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  muted_categories text[] NOT NULL DEFAULT '{}',
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification preferences" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_preferences_set_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- events (Analytics module) — partitioned by occurrence time
-- ============================================================
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  event_type text NOT NULL,
  subject_type text,
  subject_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE public.events_default PARTITION OF public.events DEFAULT;
CREATE INDEX events_type_idx ON public.events (event_type, occurred_at DESC);
CREATE INDEX events_payload_gin ON public.events USING gin (payload);

GRANT SELECT, INSERT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
GRANT SELECT, INSERT ON public.events_default TO authenticated;
GRANT ALL ON public.events_default TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actors can record events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE POLICY "admins read events" ON public.events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));