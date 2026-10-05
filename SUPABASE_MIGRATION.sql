-- ============================================================
-- REQUIRED SUPABASE SQL MIGRATION
-- Run every statement below in the Supabase SQL Editor.
-- All features (DMs, notifications, user search) depend on this.
-- ============================================================


-- ── 1. private_messages table ─────────────────────────────────────────────────
-- Schema: id, sender_username, recipient_username, text, image_url, read, created_at
-- (No sender_id or recipient_id — the app uses username strings only)

CREATE TABLE IF NOT EXISTS private_messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_username    TEXT    NOT NULL,
  recipient_username TEXT    NOT NULL,
  text          TEXT,
  image_url     TEXT,
  read          BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-user conversation queries
CREATE INDEX IF NOT EXISTS idx_pm_sender   ON private_messages (sender_username);
CREATE INDEX IF NOT EXISTS idx_pm_recipient ON private_messages (recipient_username);

-- Enable Realtime for live DM delivery
ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

-- Row Level Security: allow all authenticated and anonymous operations
-- (The app uses the anon key for all requests, so policies must allow anon role)
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON private_messages;
DROP POLICY IF EXISTS "pm_insert" ON private_messages;
DROP POLICY IF EXISTS "pm_update" ON private_messages;
CREATE POLICY "pm_select" ON private_messages FOR SELECT USING (true);
CREATE POLICY "pm_insert" ON private_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_update" ON private_messages FOR UPDATE USING (true);


-- ── 2. kv_store_ea58c774 (social data: notifications, user_directory, etc.) ───
-- This table stores all KV data: notifications, followers, profiles, etc.

CREATE TABLE IF NOT EXISTS kv_store_ea58c774 (
  key   TEXT PRIMARY KEY,
  value JSONB
);

ALTER TABLE kv_store_ea58c774 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kv_select" ON kv_store_ea58c774;
DROP POLICY IF EXISTS "kv_insert" ON kv_store_ea58c774;
DROP POLICY IF EXISTS "kv_update" ON kv_store_ea58c774;
DROP POLICY IF EXISTS "kv_delete" ON kv_store_ea58c774;
CREATE POLICY "kv_select" ON kv_store_ea58c774 FOR SELECT USING (true);
CREATE POLICY "kv_insert" ON kv_store_ea58c774 FOR INSERT WITH CHECK (true);
CREATE POLICY "kv_update" ON kv_store_ea58c774 FOR UPDATE USING (true);
CREATE POLICY "kv_delete" ON kv_store_ea58c774 FOR DELETE USING (true);


-- ── 3. chat_messages (public channel chat) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id          TEXT        NOT NULL DEFAULT 'global',
  sender_username     TEXT        NOT NULL,
  sender_avatar       TEXT,
  text                TEXT,
  image_url           TEXT,
  reply_to_id         UUID,
  reply_to_username   TEXT,
  reply_to_text       TEXT,
  is_guest            BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_channel ON chat_messages (channel_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select" ON chat_messages;
DROP POLICY IF EXISTS "cm_insert" ON chat_messages;
CREATE POLICY "cm_select" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "cm_insert" ON chat_messages FOR INSERT WITH CHECK (true);


-- ── 4. chat_channels ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_channels (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  type        TEXT        DEFAULT 'text',
  is_default  BOOLEAN     DEFAULT false,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc_select" ON chat_channels;
DROP POLICY IF EXISTS "cc_insert" ON chat_channels;
DROP POLICY IF EXISTS "cc_update" ON chat_channels;
DROP POLICY IF EXISTS "cc_delete" ON chat_channels;
CREATE POLICY "cc_select" ON chat_channels FOR SELECT USING (true);
CREATE POLICY "cc_insert" ON chat_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "cc_update" ON chat_channels FOR UPDATE USING (true);
CREATE POLICY "cc_delete" ON chat_channels FOR DELETE USING (true);

-- Seed default channels if they don't exist
INSERT INTO chat_channels (id, name, type, is_default)
VALUES
  ('global',  '# general',  'text', true),
  ('movies',  '# movies',   'text', true),
  ('offtopic','# off-topic', 'text', true)
ON CONFLICT (id) DO NOTHING;


-- ── 5. user_bans ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_bans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT        NOT NULL,
  banned_by   TEXT        NOT NULL,
  ban_type    TEXT        DEFAULT 'ban',
  reason      TEXT,
  expires_at  TIMESTAMPTZ,
  active      BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ub_select" ON user_bans;
DROP POLICY IF EXISTS "ub_insert" ON user_bans;
DROP POLICY IF EXISTS "ub_update" ON user_bans;
CREATE POLICY "ub_select" ON user_bans FOR SELECT USING (true);
CREATE POLICY "ub_insert" ON user_bans FOR INSERT WITH CHECK (true);
CREATE POLICY "ub_update" ON user_bans FOR UPDATE USING (true);


-- ── 6. profiles (for mod role lookup used in report notifications) ────────────

CREATE TABLE IF NOT EXISTS profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  role     TEXT DEFAULT 'user'
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_select" ON profiles;
DROP POLICY IF EXISTS "p_insert" ON profiles;
DROP POLICY IF EXISTS "p_update" ON profiles;
CREATE POLICY "p_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "p_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "p_update" ON profiles FOR UPDATE USING (true);


-- ── 7. Auth trigger: auto-populate profiles on new user registration ──────────
-- This ensures every registered user appears in user search immediately.
-- The app reads raw_user_meta_data->>'username' which is set by the app on sign-up.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(EXCLUDED.username, profiles.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users into profiles (run once):
INSERT INTO public.profiles (id, username, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  'user'
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET username = COALESCE(EXCLUDED.username, profiles.username);


-- ── 8. Enable Supabase Realtime on all tables that need it ────────────────────
-- (The ALTER PUBLICATION statements above handle this; run this if they error)
-- ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;


-- ── VERIFICATION QUERIES ──────────────────────────────────────────────────────
-- After running the migration, run these to confirm:

-- Check private_messages is writable:
-- INSERT INTO private_messages (sender_username, recipient_username, text)
-- VALUES ('test_sender', 'test_recipient', 'test') RETURNING *;

-- Check kv_store is writable:
-- INSERT INTO kv_store_ea58c774 (key, value) VALUES ('test_key', '"test_value"'::jsonb)
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING *;

-- Check RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('private_messages', 'kv_store_ea58c774', 'chat_messages');
