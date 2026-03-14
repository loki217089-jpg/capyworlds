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

    return new Response('Not Found', { status: 404 });
  }
};
