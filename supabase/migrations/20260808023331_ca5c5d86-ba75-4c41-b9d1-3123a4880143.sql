-- ============================================================
-- 1. Private schema for internal permission helpers
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.owns_athlete(_athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = _athlete_id AND a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.owns_coach(_coach_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = _coach_id AND c.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.in_conversation(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_conversations c
    WHERE c.id = _conversation_id
      AND (
        EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = c.athlete_id AND a.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.coaches co WHERE co.id = c.coach_id AND co.user_id = auth.uid())
      )
  );
$$;

-- Mirrors programs_secrecy_select: owning coach, athlete after completion, or admin.
CREATE OR REPLACE FUNCTION private.can_read_program(_program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = _program_id
      AND (
        EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = p.coach_id AND c.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
          WHERE ch.id = p.challenge_id AND a.user_id = auth.uid()
            AND ch.state IN ('COMPLETED','ARCHIVED')
        )
        OR private.has_role(auth.uid(), 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.owns_program(_program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p JOIN public.coaches c ON c.id = p.coach_id
    WHERE p.id = _program_id AND c.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public, anon;
REVOKE ALL ON FUNCTION private.owns_athlete(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION private.owns_coach(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION private.in_conversation(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION private.can_read_program(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION private.owns_program(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_athlete(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_coach(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.in_conversation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_program(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_program(uuid) TO authenticated, service_role;

-- ============================================================
-- 2. Recreate every policy that referenced the public helpers
-- ============================================================
DROP POLICY IF EXISTS "requests_owner_all" ON public.athlete_requests;
CREATE POLICY "requests_owner_all" ON public.athlete_requests FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid())
       OR private.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "athletes_select_own" ON public.athletes;
CREATE POLICY "athletes_select_own" ON public.athletes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "matches_visible" ON public.challenge_coach_matches;
CREATE POLICY "matches_visible" ON public.challenge_coach_matches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
                  WHERE ch.id = challenge_id AND a.user_id = auth.uid())
       OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "challenges_visible" ON public.challenges;
CREATE POLICY "challenges_visible" ON public.challenges FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = athlete_id AND a.user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.challenge_coach_matches m JOIN public.coaches c ON c.id = m.coach_id
                  WHERE m.challenge_id = challenges.id AND c.user_id = auth.uid())
       OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "coaches_select_gated" ON public.coaches;
CREATE POLICY "coaches_select_gated" ON public.coaches FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin')
       OR (marketplace_enabled AND performance_score >= 60 AND deleted_at IS NULL));

DROP POLICY IF EXISTS "evaluations_visible" ON public.evaluations;
CREATE POLICY "evaluations_visible" ON public.evaluations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.programs p JOIN public.coaches c ON c.id = p.coach_id
               WHERE p.id = program_id AND c.user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
                  WHERE ch.id = challenge_id AND a.user_id = auth.uid()
                    AND ch.state IN ('COMPLETED','ARCHIVED'))
       OR private.has_role(auth.uid(), 'admin')
       OR (private.has_role(auth.uid(), 'medical_reviewer') AND escalation_level IN ('L3','L4')));

DROP POLICY IF EXISTS "admins read events" ON public.events;
CREATE POLICY "admins read events" ON public.events FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "athletes can open a conversation" ON public.marketplace_conversations;
CREATE POLICY "athletes can open a conversation" ON public.marketplace_conversations FOR INSERT TO authenticated
WITH CHECK (private.owns_athlete(athlete_id));

DROP POLICY IF EXISTS "conversation participants can read" ON public.marketplace_conversations;
CREATE POLICY "conversation participants can read" ON public.marketplace_conversations FOR SELECT TO authenticated
USING (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id));

DROP POLICY IF EXISTS "participants can touch a conversation" ON public.marketplace_conversations;
CREATE POLICY "participants can touch a conversation" ON public.marketplace_conversations FOR UPDATE TO authenticated
USING (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id))
WITH CHECK (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id));

DROP POLICY IF EXISTS "athletes can request a hire" ON public.marketplace_hires;
CREATE POLICY "athletes can request a hire" ON public.marketplace_hires FOR INSERT TO authenticated
WITH CHECK (private.owns_athlete(athlete_id));

DROP POLICY IF EXISTS "hire participants can read" ON public.marketplace_hires;
CREATE POLICY "hire participants can read" ON public.marketplace_hires FOR SELECT TO authenticated
USING (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id));

DROP POLICY IF EXISTS "hire participants can update" ON public.marketplace_hires;
CREATE POLICY "hire participants can update" ON public.marketplace_hires FOR UPDATE TO authenticated
USING (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id))
WITH CHECK (private.owns_athlete(athlete_id) OR private.owns_coach(coach_id));

DROP POLICY IF EXISTS "participants can mark messages read" ON public.marketplace_messages;
CREATE POLICY "participants can mark messages read" ON public.marketplace_messages FOR UPDATE TO authenticated
USING (private.in_conversation(conversation_id))
WITH CHECK (private.in_conversation(conversation_id));

DROP POLICY IF EXISTS "participants can read messages" ON public.marketplace_messages;
CREATE POLICY "participants can read messages" ON public.marketplace_messages FOR SELECT TO authenticated
USING (private.in_conversation(conversation_id));

DROP POLICY IF EXISTS "participants can send messages" ON public.marketplace_messages;
CREATE POLICY "participants can send messages" ON public.marketplace_messages FOR INSERT TO authenticated
WITH CHECK (private.in_conversation(conversation_id) AND sender_id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "programs_secrecy_select" ON public.programs;
CREATE POLICY "programs_secrecy_select" ON public.programs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
       OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
                  WHERE ch.id = challenge_id AND a.user_id = auth.uid()
                    AND ch.state IN ('COMPLETED','ARCHIVED'))
       OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

-- Now the public helpers have no dependents.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.owns_athlete(uuid);
DROP FUNCTION IF EXISTS public.owns_coach(uuid);
DROP FUNCTION IF EXISTS public.in_conversation(uuid);

-- ============================================================
-- 3. evaluation_results — require ownership of the evaluation chain
-- ============================================================
DROP POLICY IF EXISTS "evaluation_results_visible" ON public.evaluation_results;
CREATE POLICY "evaluation_results_visible" ON public.evaluation_results FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.evaluations e
  WHERE e.id = evaluation_id
    AND (
      EXISTS (SELECT 1 FROM public.programs p JOIN public.coaches c ON c.id = p.coach_id
              WHERE p.id = e.program_id AND c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.challenges ch JOIN public.athletes a ON a.id = ch.athlete_id
                 WHERE ch.id = e.challenge_id AND a.user_id = auth.uid()
                   AND ch.state IN ('COMPLETED','ARCHIVED'))
      OR private.has_role(auth.uid(), 'admin')
      OR (private.has_role(auth.uid(), 'medical_reviewer') AND e.escalation_level IN ('L3','L4'))
    )
));

-- ============================================================
-- 4. Program children — ownership-scoped reads, coach-only writes
-- ============================================================
DROP POLICY IF EXISTS "weeks_via_program" ON public.program_weeks;
CREATE POLICY "weeks_readable_by_participants" ON public.program_weeks FOR SELECT TO authenticated
USING (private.can_read_program(program_id));
CREATE POLICY "weeks_writable_by_owning_coach" ON public.program_weeks FOR ALL TO authenticated
USING (private.owns_program(program_id))
WITH CHECK (private.owns_program(program_id));

DROP POLICY IF EXISTS "days_via_week" ON public.program_days;
CREATE POLICY "days_readable_by_participants" ON public.program_days FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.program_weeks w
               WHERE w.id = week_id AND private.can_read_program(w.program_id)));
CREATE POLICY "days_writable_by_owning_coach" ON public.program_days FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.program_weeks w
               WHERE w.id = week_id AND private.owns_program(w.program_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.program_weeks w
                    WHERE w.id = week_id AND private.owns_program(w.program_id)));

DROP POLICY IF EXISTS "exercises_via_day" ON public.program_exercises;
CREATE POLICY "exercises_readable_by_participants" ON public.program_exercises FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.program_days d JOIN public.program_weeks w ON w.id = d.week_id
               WHERE d.id = day_id AND private.can_read_program(w.program_id)));
CREATE POLICY "exercises_writable_by_owning_coach" ON public.program_exercises FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.program_days d JOIN public.program_weeks w ON w.id = d.week_id
               WHERE d.id = day_id AND private.owns_program(w.program_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.program_days d JOIN public.program_weeks w ON w.id = d.week_id
                    WHERE d.id = day_id AND private.owns_program(w.program_id)));

-- ============================================================
-- 5. coach_performance_scores — owner or admin only
-- ============================================================
DROP POLICY IF EXISTS "score history readable by authenticated" ON public.coach_performance_scores;
CREATE POLICY "score history readable by owner or admin" ON public.coach_performance_scores FOR SELECT TO authenticated
USING (private.owns_coach(coach_id) OR private.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 6. avatars bucket — folder ownership on read
-- ============================================================
DROP POLICY IF EXISTS "avatars readable by signed-in users" ON storage.objects;
CREATE POLICY "users read their own avatar" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);