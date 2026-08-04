-- ============================================================
-- ScienceFit MVP - vertical slice schema
-- Module boundaries are enforced by naming convention + RLS.
-- TODO: Governance gap - exact table/column definitions come from
-- ARCHITECTURE.md Section 4.1, which was not provided. This schema
-- covers only entities named verbatim in the build brief.
-- Requires clarification from Principal Backend Architect.
-- ============================================================

-- ---------- shared helpers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- Analytics module: audit_logs (partitioned) ----------
CREATE TABLE public.audit_logs (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,
  table_name   text NOT NULL,
  record_id    uuid,
  operation    text NOT NULL,
  old_data     jsonb,
  new_data     jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE public.audit_logs_default PARTITION OF public.audit_logs DEFAULT;
CREATE INDEX audit_logs_brin ON public.audit_logs USING BRIN (occurred_at);
CREATE INDEX audit_logs_new_data_gin ON public.audit_logs USING GIN (new_data);

GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, table_name, record_id, operation, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

-- ---------- Enums (verbatim from Business Protocol lifecycles in brief) ----------
CREATE TYPE public.app_role AS ENUM ('athlete','coach','admin','organization','medical_reviewer');

CREATE TYPE public.athlete_state AS ENUM (
  'UNREGISTERED','REGISTERED','ACTIVE','REQUEST_PENDING','VALID','CHALLENGE_ACTIVE',
  'PROGRAM_DELIVERED','IN_PROGRESS','COMPLETED','PRIVATE_CLIENT');

CREATE TYPE public.coach_state AS ENUM (
  'UNREGISTERED','PENDING_VERIFICATION','VERIFIED','QUALIFIED','ACTIVE','PROGRAMMING',
  'SUBMITTED','EVALUATION_PENDING','RESULTS_RECEIVED','MARKETPLACE_ELIGIBLE','PRIVATE_CLIENT_ACTIVE');

CREATE TYPE public.challenge_state AS ENUM (
  'DRAFT','PUBLISHED','ACTIVE','LOCKED','EVALUATING','COMPLETED','ARCHIVED');

CREATE TYPE public.request_state AS ENUM (
  'DRAFT','AI_VALIDATING','VALID','REJECTED');

CREATE TYPE public.evaluation_status AS ENUM (
  'QUEUED','ANONYMIZING','RUNNING','ESCALATED','COMPLETED','AUTO_REJECTED','FAILED');

CREATE TYPE public.escalation_level AS ENUM ('NONE','L1','L2','L3','L4','L5');

CREATE TYPE public.evaluation_dimension AS ENUM (
  'SAFETY','GOAL_ALIGNMENT','PERSONALIZATION','PROGRAMMING_QUALITY',
  'SCIENTIFIC_CONSISTENCY','PRACTICALITY','COMMUNICATION_QUALITY');

CREATE TYPE public.match_status AS ENUM ('INVITED','ACCEPTED','DECLINED','SUBMITTED','WITHDRAWN');

-- ---------- Users module ----------
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  country      text,
  city         text,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- Athletes module ----------
CREATE TABLE public.athletes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  state      public.athlete_state NOT NULL DEFAULT 'REGISTERED',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.athletes TO authenticated;
GRANT ALL ON public.athletes TO service_role;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- ---------- Coaches module ----------
CREATE TABLE public.coaches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  state               public.coach_state NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verified_at         timestamptz,
  specializations     text[] NOT NULL DEFAULT '{}',
  -- Performance Score is produced by the evaluation engine, never by the app.
  -- TODO: Governance gap - Performance Score calculation is defined in
  -- AI Evaluation Engine Section 12 / Business Protocol Section 11, not provided.
  -- Requires clarification from Principal Backend Architect.
  performance_score   numeric(5,2),
  marketplace_enabled boolean NOT NULL DEFAULT false,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- ---------- Athlete requests ----------
-- TODO: Governance gap - the owning module and table name for the athlete
-- Request entity are not stated in the brief's 11-module table list.
-- Requires clarification from Principal Backend Architect.
CREATE TABLE public.athlete_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id        uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  goal              text NOT NULL,
  experience_level  text NOT NULL,
  training_days     smallint NOT NULL,
  session_minutes   smallint NOT NULL,
  equipment         text[] NOT NULL DEFAULT '{}',
  injury_notes      text,
  clinical_flag     boolean NOT NULL DEFAULT false,
  state             public.request_state NOT NULL DEFAULT 'DRAFT',
  validation_notes  jsonb,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX athlete_requests_athlete_idx ON public.athlete_requests(athlete_id);
CREATE INDEX athlete_requests_validation_gin ON public.athlete_requests USING GIN (validation_notes);
GRANT SELECT, INSERT, UPDATE ON public.athlete_requests TO authenticated;
GRANT ALL ON public.athlete_requests TO service_role;
ALTER TABLE public.athlete_requests ENABLE ROW LEVEL SECURITY;

-- ---------- Evaluation criteria versions (pinned per challenge) ----------
CREATE TABLE public.evaluation_criteria_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version    text NOT NULL UNIQUE,
  weights    jsonb NOT NULL,
  active     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_criteria_versions TO authenticated, anon;
GRANT ALL ON public.evaluation_criteria_versions TO service_role;
ALTER TABLE public.evaluation_criteria_versions ENABLE ROW LEVEL SECURITY;

-- The 7 dimensions and weights are stated verbatim in the build brief.
INSERT INTO public.evaluation_criteria_versions (version, weights, active) VALUES (
  'seev2-1.0.0',
  '{"SAFETY":1.5,"GOAL_ALIGNMENT":1.2,"PERSONALIZATION":1.0,"PROGRAMMING_QUALITY":1.0,"SCIENTIFIC_CONSISTENCY":1.0,"PRACTICALITY":0.8,"COMMUNICATION_QUALITY":0.8}'::jsonb,
  true
);

-- ---------- Challenges module ----------
CREATE TABLE public.challenges (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           uuid NOT NULL UNIQUE REFERENCES public.athlete_requests(id) ON DELETE CASCADE,
  athlete_id           uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  state                public.challenge_state NOT NULL DEFAULT 'DRAFT',
  opened_at            timestamptz,
  deadline_at          timestamptz NOT NULL,
  locked_at            timestamptz,
  completed_at         timestamptz,
  criteria_version_id  uuid NOT NULL REFERENCES public.evaluation_criteria_versions(id),
  anonymity_salt       text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_state_idx ON public.challenges(state);
CREATE INDEX challenges_deadline_brin ON public.challenges USING BRIN (deadline_at);
GRANT SELECT, INSERT, UPDATE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Deadline immutability (Business Protocol: "Deadline enforcement (immutable)")
CREATE OR REPLACE FUNCTION public.enforce_deadline_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.deadline_at IS DISTINCT FROM NEW.deadline_at THEN
    RAISE EXCEPTION 'CHALLENGE_DEADLINE_IMMUTABLE';
  END IF;
  IF OLD.criteria_version_id IS DISTINCT FROM NEW.criteria_version_id THEN
    RAISE EXCEPTION 'CHALLENGE_CRITERIA_VERSION_PINNED';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenges_deadline_immutable
BEFORE UPDATE ON public.challenges FOR EACH ROW
EXECUTE FUNCTION public.enforce_deadline_immutable();

CREATE TABLE public.challenge_coach_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  coach_id      uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  status        public.match_status NOT NULL DEFAULT 'INVITED',
  invited_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, coach_id)
);
GRANT SELECT, INSERT, UPDATE ON public.challenge_coach_matches TO authenticated;
GRANT ALL ON public.challenge_coach_matches TO service_role;
ALTER TABLE public.challenge_coach_matches ENABLE ROW LEVEL SECURITY;

-- ---------- Programs module ----------
CREATE TABLE public.programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  coach_id        uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  title           text NOT NULL DEFAULT '',
  summary         text NOT NULL DEFAULT '',
  submitted_at    timestamptz,
  locked_at       timestamptz,
  -- Salted, per-challenge anonymous hash. Reverse lookup requires the
  -- challenge-scoped salt held on public.challenges.
  anonymous_hash  text,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One Submission Per Coach (Business Protocol Challenge Rules)
  UNIQUE (challenge_id, coach_id)
);
CREATE INDEX programs_challenge_idx ON public.programs(challenge_id);
GRANT SELECT, INSERT, UPDATE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_program_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'PROGRAM_LOCKED';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER programs_lock_guard
BEFORE UPDATE ON public.programs FOR EACH ROW
EXECUTE FUNCTION public.enforce_program_lock();

CREATE TABLE public.program_weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  week_number smallint NOT NULL,
  focus       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_weeks TO authenticated;
GRANT ALL ON public.program_weeks TO service_role;
ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.program_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id     uuid NOT NULL REFERENCES public.program_weeks(id) ON DELETE CASCADE,
  day_number  smallint NOT NULL,
  title       text NOT NULL DEFAULT '',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, day_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_days TO authenticated;
GRANT ALL ON public.program_days TO service_role;
ALTER TABLE public.program_days ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.program_exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id      uuid NOT NULL REFERENCES public.program_days(id) ON DELETE CASCADE,
  position    smallint NOT NULL DEFAULT 0,
  name        text NOT NULL,
  sets        smallint,
  reps        text,
  load_note   text,
  rest_note   text,
  coaching_cue text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX program_exercises_day_idx ON public.program_exercises(day_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_exercises TO authenticated;
GRANT ALL ON public.program_exercises TO service_role;
ALTER TABLE public.program_exercises ENABLE ROW LEVEL SECURITY;

-- ---------- Evaluation module ----------
CREATE TABLE public.evaluations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid NOT NULL UNIQUE REFERENCES public.programs(id) ON DELETE CASCADE,
  challenge_id        uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  criteria_version_id uuid NOT NULL REFERENCES public.evaluation_criteria_versions(id),
  anonymous_hash      text NOT NULL,
  status              public.evaluation_status NOT NULL DEFAULT 'QUEUED',
  escalation_level    public.escalation_level NOT NULL DEFAULT 'NONE',
  escalation_due_at   timestamptz,
  -- Supplied by the SEEv2 engine. The app never computes it.
  -- TODO: Governance gap - overall score aggregation formula is defined in
  -- AI Evaluation Engine, not provided. Requires clarification.
  overall_score       numeric(5,2),
  queued_at           timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  rank                integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evaluations_challenge_idx ON public.evaluations(challenge_id);
CREATE INDEX evaluations_escalation_idx ON public.evaluations(escalation_level, status);
GRANT SELECT ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Historical evaluations are immutable once completed.
CREATE OR REPLACE FUNCTION public.enforce_evaluation_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('COMPLETED','AUTO_REJECTED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'EVALUATION_IMMUTABLE';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER evaluations_immutable
BEFORE UPDATE ON public.evaluations FOR EACH ROW
EXECUTE FUNCTION public.enforce_evaluation_immutable();

CREATE TABLE public.evaluation_results (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id  uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  dimension      public.evaluation_dimension NOT NULL,
  weight         numeric(3,2) NOT NULL,
  score          numeric(5,2) NOT NULL,
  confidence     numeric(4,3) NOT NULL,
  reasoning      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, dimension)
);
CREATE INDEX evaluation_results_reasoning_gin ON public.evaluation_results USING GIN (reasoning);
GRANT SELECT ON public.evaluation_results TO authenticated;
GRANT ALL ON public.evaluation_results TO service_role;
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY athletes_select_own ON public.athletes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY athletes_insert_own ON public.athletes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY athletes_update_own ON public.athletes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Coaches are browsable per marketplace gating (Performance Score >= 60).
CREATE POLICY coaches_select_gated ON public.coaches FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR (marketplace_enabled AND performance_score >= 60 AND deleted_at IS NULL)
  );
CREATE POLICY coaches_insert_own ON public.coaches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY coaches_update_own ON public.coaches FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY criteria_versions_read ON public.evaluation_criteria_versions
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY requests_owner_all ON public.athlete_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid()));

CREATE POLICY challenges_visible ON public.challenges FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.challenge_coach_matches m
      JOIN public.coaches c ON c.id = m.coach_id
      WHERE m.challenge_id = challenges.id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY matches_visible ON public.challenge_coach_matches FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
               WHERE ch.id = challenge_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY matches_coach_respond ON public.challenge_coach_matches FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid()));

-- Submission secrecy: a coach sees only their own program while the challenge
-- is open. The athlete sees all programs only once the challenge is COMPLETED.
CREATE POLICY programs_secrecy_select ON public.programs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
      WHERE ch.id = challenge_id AND a.user_id = auth.uid()
        AND ch.state IN ('COMPLETED','ARCHIVED'))
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY programs_coach_insert ON public.programs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid()));
CREATE POLICY programs_coach_update ON public.programs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid()));

CREATE POLICY weeks_via_program ON public.program_weeks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.programs p JOIN public.coaches c ON c.id = p.coach_id
                      WHERE p.id = program_id AND c.user_id = auth.uid()));
CREATE POLICY days_via_week ON public.program_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.program_weeks w WHERE w.id = week_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.program_weeks w JOIN public.programs p ON p.id = w.program_id
                      JOIN public.coaches c ON c.id = p.coach_id
                      WHERE w.id = week_id AND c.user_id = auth.uid()));
CREATE POLICY exercises_via_day ON public.program_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.program_days d WHERE d.id = day_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.program_days d JOIN public.program_weeks w ON w.id = d.week_id
                      JOIN public.programs p ON p.id = w.program_id
                      JOIN public.coaches c ON c.id = p.coach_id
                      WHERE d.id = day_id AND c.user_id = auth.uid()));

CREATE POLICY evaluations_visible ON public.evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.programs p JOIN public.coaches c ON c.id = p.coach_id
            WHERE p.id = program_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
               WHERE ch.id = challenge_id AND a.user_id = auth.uid()
                 AND ch.state IN ('COMPLETED','ARCHIVED'))
    OR public.has_role(auth.uid(),'admin')
    -- Attribute-based: medical reviewers see only L3/L4 escalations.
    OR (public.has_role(auth.uid(),'medical_reviewer') AND escalation_level IN ('L3','L4'))
  );

CREATE POLICY evaluation_results_visible ON public.evaluation_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id));

CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- updated_at + audit triggers on all tables
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','athletes','coaches','athlete_requests','challenges',
    'challenge_coach_matches','programs','program_weeks','program_days',
    'program_exercises','evaluations'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','athletes','coaches','athlete_requests','challenges',
    'challenge_coach_matches','programs','program_weeks','program_days',
    'program_exercises','evaluations','evaluation_results'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t, t);
  END LOOP;
END $$;