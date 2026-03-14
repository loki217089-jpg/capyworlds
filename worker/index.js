export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === '/comments') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, name, content, created_at FROM comments ORDER BY created_at DESC LIMIT 50'
        ).all();
        return Response.json(results, { headers: cors });
      }

      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch {
          return Response.json({ error: '格式錯誤' }, { status: 400, headers: cors });
        }
        const name = (body.name || '').trim().slice(0, 50);
        const content = (body.content || '').trim().slice(0, 500);
        if (!name || !content) {
          return Response.json({ error: '請填寫名稱和留言' }, { status: 400, headers: cors });
        }
        await env.DB.prepare(
          'INSERT INTO comments (name, content, created_at) VALUES (?, ?, ?)'
        ).bind(name, content, new Date().toISOString()).run();
        return Response.json({ ok: true }, { headers: cors });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
