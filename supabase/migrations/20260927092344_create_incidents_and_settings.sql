/*
# Create incidents and settings tables for RecallOps

1. New Tables
- `incidents`: Stores all incident records with full lifecycle (creation, analysis, resolution).
  - id (uuid, PK)
  - title (text, not null)
  - service (text, not null)
  - severity (text, not null) — SEV-1, SEV-2, SEV-3, SEV-4
  - status (text, not null) — active, analyzing, resolved
  - description (text)
  - logs (text)
  - error_message (text)
  - recent_changes (text)
  - affected_component (text)
  - root_cause (text)
  - investigation_steps (jsonb) — array of strings
  - failed_attempts (text)
  - successful_fix (text)
  - impact (text)
  - lessons_learned (text)
  - analysis (jsonb) — full AI analysis result
  - recalled_memories (jsonb) — memories retrieved from Hindsight
  - memory_stored (boolean) — whether resolution was stored in Hindsight
  - created_at (timestamptz)
  - resolved_at (timestamptz)
- `app_settings`: Single-row key-value store for app configuration (LLM + Hindsight credentials).
  - id (int, PK, always 1)
  - llm_api_key (text)
  - llm_base_url (text)
  - llm_model (text)
  - hindsight_base_url (text)
  - hindsight_api_key (text)
  - hindsight_bank_id (text)
  - updated_at (timestamptz)

2. Security
- Enable RLS on both tables.
- Single-tenant app (no sign-in) → use TO anon, authenticated with USING (true) / WITH CHECK (true) since data is intentionally shared.
- Settings table contains API keys — but since this is a demo single-tenant app with no auth, we allow access. In production, this would be authenticated-only.
*/

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  service text NOT NULL,
  severity text NOT NULL DEFAULT 'SEV-2',
  status text NOT NULL DEFAULT 'active',
  description text,
  logs text,
  error_message text,
  recent_changes text,
  affected_component text,
  root_cause text,
  investigation_steps jsonb DEFAULT '[]'::jsonb,
  failed_attempts text,
  successful_fix text,
  impact text,
  lessons_learned text,
  analysis jsonb,
  recalled_memories jsonb,
  memory_stored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1,
  llm_api_key text,
  llm_base_url text,
  llm_model text,
  hindsight_base_url text,
  hindsight_api_key text,
  hindsight_bank_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON app_settings;
CREATE POLICY "anon_select_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON app_settings;
CREATE POLICY "anon_insert_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON app_settings;
CREATE POLICY "anon_update_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed the single settings row
INSERT INTO app_settings (id, llm_base_url, llm_model, hindsight_bank_id)
VALUES (1, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile', 'recallops-incident-memory')
ON CONFLICT (id) DO NOTHING;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents (service);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents (created_at DESC);
