-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  timezone text,
  created_at timestamptz DEFAULT now(),
  last_active timestamptz
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_year int,
  sex text,
  height_cm int,
  initial_weight_kg numeric,
  diet_pref text,
  allergies text,
  equipment text,
  injured boolean DEFAULT false,
  injury_notes text
);

-- Daily logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  workout_status text,
  workout_type text,
  meals_summary text,
  sleep_hours numeric,
  mood int,
  sick_flag boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Memories (vectors)
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  text text,
  embedding vector(1536),
  type text,
  importance int DEFAULT 1,
  persist boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- User summaries (compact embeddings)
CREATE TABLE IF NOT EXISTS user_summaries (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary_text text,
  embedding vector(1536),
  last_updated timestamptz DEFAULT now()
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  plan_json jsonb,
  generated_at timestamptz DEFAULT now(),
  generator_version text
);

-- Events / Corrections
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  type text,
  details jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);
