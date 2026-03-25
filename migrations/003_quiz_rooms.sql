-- 水豚問答PK quiz rooms
-- Run: wrangler d1 execute capyworlds-comments --remote --file migrations/003_quiz_rooms.sql

CREATE TABLE IF NOT EXISTS quiz_rooms (
  id TEXT PRIMARY KEY,
  p1_id TEXT,
  p2_id TEXT,
  p1_name TEXT DEFAULT '玩家1',
  p2_name TEXT DEFAULT '玩家2',
  state TEXT DEFAULT 'waiting',
  p1_answer INTEGER DEFAULT 0,
  p2_answer INTEGER DEFAULT 0,
  question_idx INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  p1_wins INTEGER DEFAULT 0,
  p2_wins INTEGER DEFAULT 0,
  round_start INTEGER DEFAULT 0,
  round_end INTEGER DEFAULT 0,
  winner TEXT DEFAULT '',
  created_at INTEGER
);
