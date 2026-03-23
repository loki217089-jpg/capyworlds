-- Generic multiplayer game rooms (replaces rps_rooms + quiz_rooms)
-- POST /room/:type/join  GET /room/:type/:id  POST /room/:type/:id/act
CREATE TABLE IF NOT EXISTS game_rooms (
  id           TEXT    PRIMARY KEY,
  game_type    TEXT    NOT NULL,
  p1_id        TEXT    NOT NULL,
  p2_id        TEXT,
  p1_name      TEXT    NOT NULL,
  p2_name      TEXT,
  state        TEXT    NOT NULL DEFAULT 'waiting',
  round        INTEGER NOT NULL DEFAULT 1,
  p1_wins      INTEGER NOT NULL DEFAULT 0,
  p2_wins      INTEGER NOT NULL DEFAULT 0,
  round_start  INTEGER,
  round_end    INTEGER,
  winner       TEXT,
  data         TEXT    NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gr_type_state ON game_rooms(game_type, state);
