// v1.2.0 - added 1v1 match rooms (水豚拔河)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // GET /comments
    if (url.pathname === '/comments' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, name, content, created_at, parent_id FROM comments ORDER BY created_at ASC LIMIT 200'
      ).all();
      return Response.json(results, { headers: cors });
    }

    // POST /comments
    if (url.pathname === '/comments' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: '格式錯誤' }, { status: 400, headers: cors });
      }
      const name = (body.name || '').trim().slice(0, 50);
      const content = (body.content || '').trim().slice(0, 500);
      const parent_id = body.parent_id ? parseInt(body.parent_id) : null;
      if (!name || !content) {
        return Response.json({ error: '請填寫名稱和留言' }, { status: 400, headers: cors });
      }
      await env.DB.prepare(
        'INSERT INTO comments (name, content, created_at, parent_id) VALUES (?, ?, ?, ?)'
      ).bind(name, content, new Date().toISOString(), parent_id).run();
      return Response.json({ ok: true }, { headers: cors });
    }

    // DELETE /comments/:id
    const deleteMatch = url.pathname.match(/^\/comments\/(\d+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      const auth = request.headers.get('Authorization') || '';
      const key = auth.replace('Bearer ', '');
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return Response.json({ error: '權限不足' }, { status: 401, headers: cors });
      }
      const id = parseInt(deleteMatch[1]);
      await env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
      return Response.json({ ok: true }, { headers: cors });
    }

    // GET /leaderboard/:game
    const lbGetMatch = url.pathname.match(/^\/leaderboard\/([a-z0-9_-]+)$/);
    if (lbGetMatch && request.method === 'GET') {
      const game = lbGetMatch[1];
      const { results } = await env.DB.prepare(
        'SELECT name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC LIMIT 10'
      ).bind(game).all();
      return Response.json(results, { headers: cors });
    }

    // POST /leaderboard/:game
    const lbPostMatch = url.pathname.match(/^\/leaderboard\/([a-z0-9_-]+)$/);
    if (lbPostMatch && request.method === 'POST') {
      const game = lbPostMatch[1];
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: '格式錯誤' }, { status: 400, headers: cors });
      }
      const name = (body.name || '').trim().slice(0, 30);
      const score = parseInt(body.score);
      if (!name || isNaN(score) || score < 0) {
        return Response.json({ error: '請填寫名稱與有效分數' }, { status: 400, headers: cors });
      }
      await env.DB.prepare(
        'INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)'
      ).bind(game, name, score, new Date().toISOString()).run();
      return Response.json({ ok: true }, { headers: cors });
    }

    // GET /danmaku
    if (url.pathname === '/danmaku' && request.method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0');
      const { results } = await env.DB.prepare(
        'SELECT id, text, color, created_at FROM danmaku WHERE id > ? ORDER BY id ASC LIMIT 60'
      ).bind(since).all();
      return Response.json(results, { headers: cors });
    }

    // POST /danmaku
    if (url.pathname === '/danmaku' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: '格式錯誤' }, { status: 400, headers: cors });
      }
      const text = (body.text || '').trim().slice(0, 40);
      const allowed = ['#ffffff','#ffd700','#00ffff','#ff69b4','#7fff00','#ff6347'];
      const color = allowed.includes(body.color) ? body.color : '#ffffff';
      if (!text) return Response.json({ error: '彈幕不能為空' }, { status: 400, headers: cors });
      await env.DB.prepare(
        'INSERT INTO danmaku (text, color, created_at) VALUES (?, ?, ?)'
      ).bind(text, color, new Date().toISOString()).run();
      return Response.json({ ok: true }, { headers: cors });
    }

    // ── 水豚拔河 Match API ──────────────────────────────────────

    // POST /match/join — { pid, name } → { room_id, role, state, opp_name? }
    if (url.pathname === '/match/join' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: 'bad request' }, { status: 400, headers: cors });
      }
      const pid = (body.pid || '').slice(0, 40);
      const name = (body.name || '玩家').trim().slice(0, 20) || '玩家';
      if (!pid) return Response.json({ error: 'pid required' }, { status: 400, headers: cors });

      const now = Date.now();

      // Clean up rooms older than 10 min
      await env.DB.prepare('DELETE FROM match_rooms WHERE created_at < ?').bind(now - 600000).run();

      // Check if player already has an active room
      const existing = await env.DB.prepare(
        "SELECT id, p1_id, p2_id, state FROM match_rooms WHERE (p1_id = ? OR p2_id = ?) AND state != 'done' LIMIT 1"
      ).bind(pid, pid).first();
      if (existing) {
        const role = existing.p1_id === pid ? 'p1' : 'p2';
        return Response.json({ room_id: existing.id, role, state: existing.state }, { headers: cors });
      }

      // Find a waiting room
      const waiting = await env.DB.prepare(
        "SELECT id, p1_id, p1_name FROM match_rooms WHERE state = 'waiting' LIMIT 1"
      ).first();

      if (waiting && waiting.p1_id !== pid) {
        // Join as p2, start countdown
        const round_start = now + 3500;
        const round_end = round_start + 30000;
        await env.DB.prepare(
          'UPDATE match_rooms SET p2_id=?,p2_name=?,state=?,round_start=?,round_end=? WHERE id=?'
        ).bind(pid, name, 'starting', round_start, round_end, waiting.id).run();
        return Response.json({ room_id: waiting.id, role: 'p2', state: 'starting', opp_name: waiting.p1_name }, { headers: cors });
      }

      // Check capacity (max 10 active rooms)
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) as c FROM match_rooms WHERE state != 'done'"
      ).first();
      if ((countRow?.c || 0) >= 10) {
        return Response.json({ error: '伺服器已滿，請稍後再試' }, { status: 503, headers: cors });
      }

      // Create room as p1
      const id = Math.random().toString(36).slice(2, 8).toUpperCase();
      await env.DB.prepare(
        'INSERT INTO match_rooms (id, p1_id, p1_name, state, created_at) VALUES (?,?,?,?,?)'
      ).bind(id, pid, name, 'waiting', now).run();
      return Response.json({ room_id: id, role: 'p1', state: 'waiting' }, { headers: cors });
    }

    // GET /match/:id?pid=xxx — poll state
    const matchGet = url.pathname.match(/^\/match\/([A-Z0-9]{6})$/);
    if (matchGet && request.method === 'GET') {
      const room_id = matchGet[1];
      const pid = url.searchParams.get('pid') || '';
      const now = Date.now();

      const room = await env.DB.prepare('SELECT * FROM match_rooms WHERE id=?').bind(room_id).first();
      if (!room) return Response.json({ error: 'room not found' }, { status: 404, headers: cors });

      let { state, round, p1_wins, p2_wins, round_start, round_end, p1_taps, p2_taps, winner } = room;

      if (state === 'starting' && now >= round_start) {
        // Transition to playing
        state = 'playing';
        await env.DB.prepare("UPDATE match_rooms SET state='playing' WHERE id=? AND state='starting'")
          .bind(room_id).run();
      } else if (state === 'playing') {
        // Check early win (rope off edge)
        const rp = Math.max(0, Math.min(100, 50 - (p1_taps - p2_taps) * 0.6));
        const earlyWin = rp <= 0 ? 'p1' : rp >= 100 ? 'p2' : null;

        if (earlyWin || now >= round_end) {
          let round_winner;
          if (earlyWin) {
            round_winner = earlyWin;
          } else {
            round_winner = p1_taps >= p2_taps ? 'p1' : 'p2';
          }
          if (round_winner === 'p1') p1_wins++; else p2_wins++;

          if (p1_wins >= 2 || p2_wins >= 2) {
            state = 'done';
            winner = p1_wins >= 2 ? 'p1' : 'p2';
            await env.DB.prepare(
              "UPDATE match_rooms SET state='done',p1_wins=?,p2_wins=?,winner=? WHERE id=? AND state='playing'"
            ).bind(p1_wins, p2_wins, winner, room_id).run();
          } else {
            round++;
            const ns = now + 3500;
            const ne = ns + 30000;
            state = 'starting';
            await env.DB.prepare(
              "UPDATE match_rooms SET state='starting',round=?,p1_wins=?,p2_wins=?,p1_taps=0,p2_taps=0,round_start=?,round_end=? WHERE id=? AND state='playing'"
            ).bind(round, p1_wins, p2_wins, ns, ne, room_id).run();
            p1_taps = 0; p2_taps = 0; round_start = ns; round_end = ne;
          }
        }
      }

      const rope_pos = Math.max(0, Math.min(100, 50 - (p1_taps - p2_taps) * 0.6));
      const role = room.p1_id === pid ? 'p1' : 'p2';
      const time_left = state === 'playing'
        ? Math.max(0, round_end - now)
        : state === 'starting' ? Math.max(0, round_start - now) : 0;

      return Response.json({
        state, round, p1_wins, p2_wins, rope_pos, winner, role,
        p1_name: room.p1_name, p2_name: room.p2_name || null,
        time_left, p1_taps, p2_taps
      }, { headers: cors });
    }

    // POST /match/:id/tap — { pid, taps }
    const matchTap = url.pathname.match(/^\/match\/([A-Z0-9]{6})\/tap$/);
    if (matchTap && request.method === 'POST') {
      const room_id = matchTap[1];
      let body;
      try { body = await request.json(); } catch {
        return Response.json({ error: 'bad request' }, { status: 400, headers: cors });
      }
      const pid = (body.pid || '').slice(0, 40);
      const taps = Math.max(0, Math.min(99999, parseInt(body.taps) || 0));

      const room = await env.DB.prepare('SELECT p1_id, state FROM match_rooms WHERE id=?').bind(room_id).first();
      if (!room || room.state !== 'playing') return Response.json({ ok: false }, { headers: cors });

      if (room.p1_id === pid) {
        await env.DB.prepare('UPDATE match_rooms SET p1_taps=? WHERE id=?').bind(taps, room_id).run();
      } else {
        await env.DB.prepare('UPDATE match_rooms SET p2_taps=? WHERE id=?').bind(taps, room_id).run();
      }
      return Response.json({ ok: true }, { headers: cors });
    }

    return env.ASSETS.fetch(request);
  }
};
