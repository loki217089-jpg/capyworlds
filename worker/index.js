// v1.1.0
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

    // DELETE /comments/:id  (需要管理員密碼)
    const deleteMatch = url.pathname.match(/^\/comments\/(\d+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      const auth = request.headers.get('Authorization') || '';
      const key = auth.replace('Bearer ', '');
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return Response.json({ error: '權限不足' }, { status: 401, headers: cors });
      }
      const id = parseInt(deleteMatch[1]);
      // 同時刪除此留言的所有回覆
      await env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
      return Response.json({ ok: true }, { headers: cors });
    }

    // GET /leaderboard/:game — top 10 scores
    const lbGetMatch = url.pathname.match(/^\/leaderboard\/([a-z0-9_-]+)$/);
    if (lbGetMatch && request.method === 'GET') {
      const game = lbGetMatch[1];
      const { results } = await env.DB.prepare(
        'SELECT name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC LIMIT 10'
      ).bind(game).all();
      return Response.json(results, { headers: cors });
    }

    // POST /leaderboard/:game — submit score { name, score }
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

    // GET /danmaku?since=ID — 取最近 60 條彈幕（since 為 0 時取全部近 60 條）
    if (url.pathname === '/danmaku' && request.method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0');
      const { results } = await env.DB.prepare(
        'SELECT id, text, color, created_at FROM danmaku WHERE id > ? ORDER BY id ASC LIMIT 60'
      ).bind(since).all();
      return Response.json(results, { headers: cors });
    }

    // POST /danmaku — 發送彈幕 { text, color }
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

    return new Response('Not Found', { status: 404 });
  }
};
