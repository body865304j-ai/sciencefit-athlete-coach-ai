-- Profile detail fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS show_location boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_visibility_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_visibility_check CHECK (profile_visibility IN ('public','private'));

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS experience_years smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_goal text;

-- Ownership helpers
CREATE OR REPLACE FUNCTION public.owns_athlete(_athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = _athlete_id AND a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_coach(_coach_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = _coach_id AND c.user_id = auth.uid());
$$;

-- Marketplace conversations
CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, coach_id)
);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_conversations TO authenticated;
GRANT ALL ON public.marketplace_conversations TO service_role;
ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation participants can read"
  ON public.marketplace_conversations FOR SELECT TO authenticated
  USING (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id));
CREATE POLICY "athletes can open a conversation"
  ON public.marketplace_conversations FOR INSERT TO authenticated
  WITH CHECK (public.owns_athlete(athlete_id));
CREATE POLICY "participants can touch a conversation"
  ON public.marketplace_conversations FOR UPDATE TO authenticated
  USING (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id))
  WITH CHECK (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id));

CREATE TRIGGER marketplace_conversations_set_updated_at
  BEFORE UPDATE ON public.marketplace_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.in_conversation(_conversation_id uuid)
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

CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.marketplace_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_messages_conversation_idx
  ON public.marketplace_messages (conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_messages TO authenticated;
GRANT ALL ON public.marketplace_messages TO service_role;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can read messages"
  ON public.marketplace_messages FOR SELECT TO authenticated
  USING (public.in_conversation(conversation_id));
CREATE POLICY "participants can send messages"
  ON public.marketplace_messages FOR INSERT TO authenticated
  WITH CHECK (public.in_conversation(conversation_id) AND sender_id = auth.uid());
CREATE POLICY "participants can mark messages read"
  ON public.marketplace_messages FOR UPDATE TO authenticated
  USING (public.in_conversation(conversation_id))
  WITH CHECK (public.in_conversation(conversation_id));

-- Hire requests
DO $$ BEGIN
  CREATE TYPE public.hire_status AS ENUM ('REQUESTED','ACCEPTED','DECLINED','WITHDRAWN','ACTIVE','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_hires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  status public.hire_status NOT NULL DEFAULT 'REQUESTED',
  goal text NOT NULL,
  note text,
  coach_score_at_request numeric,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_hires_coach_idx ON public.marketplace_hires (coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_hires_athlete_idx ON public.marketplace_hires (athlete_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_hires TO authenticated;
GRANT ALL ON public.marketplace_hires TO service_role;
ALTER TABLE public.marketplace_hires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hire participants can read"
  ON public.marketplace_hires FOR SELECT TO authenticated
  USING (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id));
CREATE POLICY "athletes can request a hire"
  ON public.marketplace_hires FOR INSERT TO authenticated
  WITH CHECK (public.owns_athlete(athlete_id));
CREATE POLICY "hire participants can update"
  ON public.marketplace_hires FOR UPDATE TO authenticated
  USING (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id))
  WITH CHECK (public.owns_athlete(athlete_id) OR public.owns_coach(coach_id));

CREATE TRIGGER marketplace_hires_set_updated_at
  BEFORE UPDATE ON public.marketplace_hires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
