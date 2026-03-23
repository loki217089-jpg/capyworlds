-- 1對1情境聊天室
CREATE TABLE IF NOT EXISTS chat_rooms (
  id           TEXT    PRIMARY KEY,
  p1_id        TEXT    NOT NULL,
  p2_id        TEXT,
  p1_name      TEXT    NOT NULL,
  p2_name      TEXT,
  p1_gender    TEXT    NOT NULL,
  p2_gender    TEXT,
  state        TEXT    NOT NULL DEFAULT 'waiting',
  scenario_id  INTEGER NOT NULL DEFAULT 0,
  scenario_req TEXT,
  timer_end    INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    TEXT    NOT NULL,
  role       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  msg_type   TEXT    NOT NULL DEFAULT 'text',
  content    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cm_room ON chat_messages(room_id, id);
CREATE INDEX IF NOT EXISTS idx_cr_state ON chat_rooms(state);
