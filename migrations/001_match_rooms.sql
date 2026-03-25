-- 水豚拔河 1v1 match rooms
-- Run: wrangler d1 execute capyworlds-comments --remote --file migrations/001_match_rooms.sql

CREATE TABLE IF NOT EXISTS match_rooms (
  id TEXT PRIMARY KEY,
  p1_id TEXT,
  p2_id TEXT,
  p1_name TEXT DEFAULT '玩家1',
  p2_name TEXT DEFAULT '玩家2',
  state TEXT DEFAULT 'waiting',
  p1_taps INTEGER DEFAULT 0,
  p2_taps INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  p1_wins INTEGER DEFAULT 0,
  p2_wins INTEGER DEFAULT 0,
  round_start INTEGER DEFAULT 0,
  round_end INTEGER DEFAULT 0,
  winner TEXT DEFAULT '',
  created_at INTEGER
);
