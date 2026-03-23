-- 水豚猜拳 RPS rooms
-- Run: wrangler d1 execute capyworlds-comments --remote --file migrations/002_rps_rooms.sql

CREATE TABLE IF NOT EXISTS rps_rooms (
  id TEXT PRIMARY KEY,
  p1_id TEXT,
  p2_id TEXT,
  p1_name TEXT DEFAULT '玩家1',
  p2_name TEXT DEFAULT '玩家2',
  state TEXT DEFAULT 'waiting',
  p1_choice TEXT DEFAULT '',
  p2_choice TEXT DEFAULT '',
  round INTEGER DEFAULT 1,
  p1_wins INTEGER DEFAULT 0,
  p2_wins INTEGER DEFAULT 0,
  round_start INTEGER DEFAULT 0,
  round_end INTEGER DEFAULT 0,
  winner TEXT DEFAULT '',
  created_at INTEGER
);
