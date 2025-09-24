-- 1) Profiles: add columns for onboarding + flexible storage
ALTER TABLE public.profiles
  ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN preferred_coach_tone VARCHAR(20) CHECK (preferred_coach_tone IN ('supportive','strict','neutral')) DEFAULT 'supportive',
  ADD COLUMN training_experience VARCHAR(20) CHECK (training_experience IN ('none','some','regular')) DEFAULT 'some',
  ADD COLUMN contact_email TEXT,
  ADD COLUMN consent_profile JSONB,            -- { consent_given: true, consent_date: timestamptz, terms_version: 'v1' }
  ADD COLUMN additional_profile JSONB;        -- freeform parsed fields (measurements, schedule slots, photos refs)

-- 2) Safety additions to profiles
ALTER TABLE public.profiles
  ADD COLUMN injury_severity SMALLINT,        -- e.g., 0 = none, 1 = mild, 2 = moderate, 3 = severe
  ADD COLUMN safety_review_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN medications TEXT;

-- 3) Plans: metadata for review & reproducibility
ALTER TABLE public.plans
  ADD COLUMN status VARCHAR(20) CHECK (status IN ('draft','active','archived')) DEFAULT 'active',
  ADD COLUMN summary_text TEXT,
  ADD COLUMN trigger_reason VARCHAR(30) DEFAULT 'auto', -- 'auto' | 'manual' | 'user'
  ADD COLUMN required_fields_snapshot JSONB,  -- snapshot of canonical fields used for generation
  ADD COLUMN safety_analysis JSONB,           -- safety analysis results from plan generation
  ADD COLUMN guardrails_applied JSONB,        -- list of guardrails that were applied
  ADD COLUMN safety_review_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN safety_review_approved BOOLEAN,
  ADD COLUMN safety_reviewer_id UUID REFERENCES public.users(id),
  ADD COLUMN safety_review_notes TEXT,
  ADD COLUMN safety_review_date TIMESTAMPTZ,
  ADD COLUMN safety_modifications JSONB;

-- 4) Onboarding sessions table (tracks a whole conversation/session)
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE DEFAULT gen_random_uuid(), -- External session identifier
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_started_at TIMESTAMPTZ DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  status VARCHAR(25) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'awaiting_clarification', 'completed', 'abandoned')),
  missing_required_fields JSONB,             -- list of required fields still missing
  completion_percentage INTEGER DEFAULT 0,
  ready_for_plan_generation BOOLEAN DEFAULT FALSE,
  safety_review_required BOOLEAN DEFAULT FALSE,
  trigger_plan_when_ready BOOLEAN DEFAULT TRUE,
  abandoned_reason VARCHAR(255),
  plan_generation_attempts INTEGER DEFAULT 0,
  last_readiness_check TIMESTAMPTZ,
  source VARCHAR(100),                       -- 'widget', 'app', 'web'
  initial_profile JSONB,                     -- Basic profile info collected before chat
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);

-- 5) Onboarding responses table (audit trail per question)
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID UNIQUE DEFAULT gen_random_uuid(), -- External response identifier
  session_id UUID, -- Can reference either internal or external session ID
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT,                           -- code-friendly id for the question (e.g., "goal_v1")
  question_text TEXT,
  raw_answer_text TEXT,
  parsed_value JSONB,                         -- canonical parsed slot(s) { field: 'primary_goal', value: 'lose_fat' }
  parsed_confidence DECIMAL(3,2) DEFAULT 1.00,-- 0.00 - 1.00
  parser_version VARCHAR(20),                 -- Version of parser used
  parsing_method VARCHAR(50),                 -- 'rule_based', 'ai_fallback', etc.
  skipped BOOLEAN DEFAULT FALSE,
  requires_clarification BOOLEAN DEFAULT FALSE,
  clarified_with_response_id UUID,            -- FK to another onboarding_responses.id if used to resolve
  answered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboard_responses_session_id ON public.onboarding_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_onboard_responses_user_id ON public.onboarding_responses(user_id);

-- 6) Quick helper: flag on users for partial onboarding preference (optional)
ALTER TABLE public.users
  ADD COLUMN last_onboarding_session UUID REFERENCES public.onboarding_sessions(id);

-- 7) Optional: small performance indexes for plans lookups
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON public.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_generated_at ON public.plans(generated_at);
