-- DESTRUCTIVE MIGRATION: Drops selected tables and recreates schema from scratch
-- Run only if you are 100% sure you want to wipe existing data for these tables.

DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.user_summaries CASCADE;
DROP TABLE IF EXISTS public.memories CASCADE;
DROP TABLE IF EXISTS public.daily_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Ensure pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (Firebase Phone Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ,
  timezone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE
);

-- Profiles table (onboarding data)
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  sex VARCHAR(10) CHECK (sex IN ('male', 'female', 'other')),
  weight_kg DECIMAL(5,2) NOT NULL,
  height_cm INTEGER,
  primary_goal VARCHAR(20) CHECK (primary_goal IN ('lose_fat', 'gain_muscle', 'recomposition', 'general_fitness')),
  target_weight_kg DECIMAL(5,2),
  activity_level VARCHAR(20) CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
  time_availability VARCHAR(15) CHECK (time_availability IN ('morning', 'evening', 'flexible')),
  diet_preference VARCHAR(15) CHECK (diet_preference IN ('veg', 'nonveg', 'vegan', 'keto', 'pescatarian', 'other')),
  allergies TEXT,
  meal_frequency VARCHAR(10) CHECK (meal_frequency IN ('3', '5', 'flexible')),
  workout_setup VARCHAR(15) CHECK (workout_setup IN ('home', 'gym', 'mixed')),
  injury VARCHAR(3) CHECK (injury IN ('yes', 'no')),
  injury_notes TEXT,
  sleep_hours DECIMAL(3,1),
  medical_conditions TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily logs
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  workout_status VARCHAR(20),
  workout_type VARCHAR(50),
  workout_notes TEXT,
  meals_summary JSONB,
  sleep_hours DECIMAL(3,1),
  mood SMALLINT,
  sick_flag BOOLEAN DEFAULT FALSE,
  adherence_score SMALLINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- Memories (vector store)
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),
  type VARCHAR(50),
  importance SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User summaries
CREATE TABLE public.user_summaries (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  summary_text TEXT,
  summary_embedding vector(1536),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Plans
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan_json JSONB NOT NULL,
  generator_version VARCHAR(50),
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Events / corrections
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  details JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON public.memories USING ivfflat (embedding) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, log_date);
