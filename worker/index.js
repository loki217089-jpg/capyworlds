// v1.3.0 - added RPS (水豚猜拳) and Quiz (水豚問答PK) rooms

// RPS: who wins between c1 (p1) and c2 (p2)?
function rpsWinner(c1, c2) {
  if (!c1 || !c2) return null;
  if (c1 === c2) return 'draw';
  if ((c1==='rock'&&c2==='scissors')||(c1==='paper'&&c2==='rock')||(c1==='scissors'&&c2==='paper')) return 'p1';
  return 'p2';
}

// Quiz questions (12 questions, answers are 0-indexed)
const QUIZ_Q = [
  {q:'水豚（Capybara）是世界上最大的什麼動物？',a:['嚙齒動物','有袋動物','猛獸','爬蟲類'],c:0},
  {q:'地球繞太陽一圈大約需要幾天？',a:['265天','365天','465天','185天'],c:1},
  {q:'1+1+1×0+1 等於幾？',a:['0','1','3','2'],c:2},
  {q:'以下哪個是台灣的國花？',a:['玫瑰','梅花','菊花','蓮花'],c:1},
  {q:'光速約為每秒幾公里？',a:['30萬公里','3萬公里','3百公里','30億公里'],c:0},
  {q:'以下哪個國家的國旗是純紅色的？',a:['中國','日本','蒙古','吐瓦魯'],c:0},
  {q:'水的沸點在標準大氣壓下是幾度？',a:['90°C','80°C','100°C','110°C'],c:2},
  {q:'以下哪個不是足球場上的位置？',a:['前鋒','守門員','角衛','中場'],c:2},
  {q:'人類有幾根肋骨（成人）？',a:['20根','24根','28根','16根'],c:1},
  {q:'哪個星球是太陽系最大的行星？',a:['土星','天王星','木星','海王星'],c:2},
  {q:'以下哪種語言使用人數最多？',a:['英語','西班牙語','普通話','印地語'],c:2},
  {q:'鑽石的主要成分是什麼？',a:['矽','碳','氧','鐵'],c:1},
];

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

    // ── 水豚猜拳 RPS API ────────────────────────────────────────

    // POST /rps/join
    if (url.pathname === '/rps/join' && request.method === 'POST') {
      let body; try { body = await request.json(); } catch { return Response.json({error:'bad request'},{status:400,headers:cors}); }
      const pid = (body.pid||'').slice(0,40), name = (body.name||'玩家').trim().slice(0,20)||'玩家';
      if (!pid) return Response.json({error:'pid required'},{status:400,headers:cors});
      const now = Date.now();
      await env.DB.prepare('DELETE FROM rps_rooms WHERE created_at < ?').bind(now-600000).run();
      const existing = await env.DB.prepare("SELECT id,p1_id,p2_id,state FROM rps_rooms WHERE (p1_id=? OR p2_id=?) AND state!='done' LIMIT 1").bind(pid,pid).first();
      if (existing) { const role=existing.p1_id===pid?'p1':'p2'; return Response.json({room_id:existing.id,role,state:existing.state},{headers:cors}); }
      const waiting = await env.DB.prepare("SELECT id,p1_id,p1_name FROM rps_rooms WHERE state='waiting' LIMIT 1").first();
      if (waiting && waiting.p1_id !== pid) {
        const rs = now+3500, re = rs+10000;
        await env.DB.prepare('UPDATE rps_rooms SET p2_id=?,p2_name=?,state=?,round_start=?,round_end=? WHERE id=?').bind(pid,name,'starting',rs,re,waiting.id).run();
        return Response.json({room_id:waiting.id,role:'p2',state:'starting',opp_name:waiting.p1_name},{headers:cors});
      }
      const countRow = await env.DB.prepare("SELECT COUNT(*) as c FROM rps_rooms WHERE state!='done'").first();
      if ((countRow?.c||0)>=10) return Response.json({error:'伺服器已滿，請稍後再試'},{status:503,headers:cors});
      const id = Math.random().toString(36).slice(2,8).toUpperCase();
      await env.DB.prepare('INSERT INTO rps_rooms (id,p1_id,p1_name,state,created_at) VALUES (?,?,?,?,?)').bind(id,pid,name,'waiting',now).run();
      return Response.json({room_id:id,role:'p1',state:'waiting'},{headers:cors});
    }

    // GET /rps/:id?pid=
    const rpsGet = url.pathname.match(/^\/rps\/([A-Z0-9]{6})$/);
    if (rpsGet && request.method === 'GET') {
      const room_id = rpsGet[1], pid = url.searchParams.get('pid')||'', now = Date.now();
      const room = await env.DB.prepare('SELECT * FROM rps_rooms WHERE id=?').bind(room_id).first();
      if (!room) return Response.json({error:'room not found'},{status:404,headers:cors});
      let {state,round,p1_wins,p2_wins,round_start,round_end,p1_choice,p2_choice,winner} = room;

      if (state==='starting' && now>=round_start) {
        state='choosing'; round_end = round_start+10000;
        await env.DB.prepare("UPDATE rps_rooms SET state='choosing',round_end=? WHERE id=? AND state='starting'").bind(round_end,room_id).run();
      } else if (state==='choosing') {
        const bothChose = p1_choice&&p2_choice;
        if (bothChose || now>=round_end) {
          const eff_p1 = p1_choice||'forfeit', eff_p2 = p2_choice||'forfeit';
          let rw;
          if (eff_p1==='forfeit'&&eff_p2==='forfeit') rw='draw';
          else if (eff_p1==='forfeit') rw='p2';
          else if (eff_p2==='forfeit') rw='p1';
          else rw = rpsWinner(eff_p1,eff_p2);
          if (rw==='p1') p1_wins++; else if (rw==='p2') p2_wins++;
          const reveal_end = now+2500;
          if (p1_wins>=2||p2_wins>=2) {
            winner = p1_wins>=2?'p1':'p2'; state='done';
            await env.DB.prepare("UPDATE rps_rooms SET state='done',p1_wins=?,p2_wins=?,winner=? WHERE id=? AND state='choosing'").bind(p1_wins,p2_wins,winner,room_id).run();
          } else {
            state='revealing'; round_start=reveal_end;
            await env.DB.prepare("UPDATE rps_rooms SET state='revealing',round_start=?,p1_wins=?,p2_wins=? WHERE id=? AND state='choosing'").bind(reveal_end,p1_wins,p2_wins,room_id).run();
          }
        }
      } else if (state==='revealing' && now>=round_start) {
        round++; const rs=now+3500, re=rs+10000;
        state='starting'; p1_choice=''; p2_choice=''; round_start=rs; round_end=re;
        await env.DB.prepare("UPDATE rps_rooms SET state='starting',round=?,p1_choice='',p2_choice='',round_start=?,round_end=? WHERE id=? AND state='revealing'").bind(round,rs,re,room_id).run();
      }

      const role = room.p1_id===pid?'p1':'p2';
      const time_left = state==='choosing' ? Math.max(0,round_end-now) : state==='starting' ? Math.max(0,round_start-now) : 0;
      return Response.json({
        state, round, p1_wins, p2_wins, winner, role,
        p1_name:room.p1_name, p2_name:room.p2_name||null,
        p1_chosen:!!(state==='choosing'||state==='revealing'||state==='done'?p1_choice:''),
        p2_chosen:!!(state==='choosing'||state==='revealing'||state==='done'?p2_choice:''),
        p1_choice: (state==='revealing'||state==='done')?p1_choice:'',
        p2_choice: (state==='revealing'||state==='done')?p2_choice:'',
        time_left
      },{headers:cors});
    }

    // POST /rps/:id/choose
    const rpsChoose = url.pathname.match(/^\/rps\/([A-Z0-9]{6})\/choose$/);
    if (rpsChoose && request.method === 'POST') {
      const room_id = rpsChoose[1];
      let body; try { body = await request.json(); } catch { return Response.json({ok:false},{headers:cors}); }
      const pid=(body.pid||'').slice(0,40), choice=(body.choice||'');
      if (!['rock','paper','scissors'].includes(choice)) return Response.json({ok:false},{headers:cors});
      const room = await env.DB.prepare('SELECT p1_id,p2_id,state,p1_choice,p2_choice FROM rps_rooms WHERE id=?').bind(room_id).first();
      if (!room||room.state!=='choosing') return Response.json({ok:false},{headers:cors});
      if (room.p1_id===pid && !room.p1_choice) {
        await env.DB.prepare('UPDATE rps_rooms SET p1_choice=? WHERE id=?').bind(choice,room_id).run();
      } else if (room.p2_id===pid && !room.p2_choice) {
        await env.DB.prepare('UPDATE rps_rooms SET p2_choice=? WHERE id=?').bind(choice,room_id).run();
      }
      return Response.json({ok:true},{headers:cors});
    }

    // ── 水豚問答PK Quiz API ─────────────────────────────────────

    // POST /quiz/join
    if (url.pathname === '/quiz/join' && request.method === 'POST') {
      let body; try { body = await request.json(); } catch { return Response.json({error:'bad request'},{status:400,headers:cors}); }
      const pid=(body.pid||'').slice(0,40), name=(body.name||'玩家').trim().slice(0,20)||'玩家';
      if (!pid) return Response.json({error:'pid required'},{status:400,headers:cors});
      const now = Date.now();
      await env.DB.prepare('DELETE FROM quiz_rooms WHERE created_at < ?').bind(now-600000).run();
      const existing = await env.DB.prepare("SELECT id,p1_id,p2_id,state FROM quiz_rooms WHERE (p1_id=? OR p2_id=?) AND state!='done' LIMIT 1").bind(pid,pid).first();
      if (existing) { const role=existing.p1_id===pid?'p1':'p2'; return Response.json({room_id:existing.id,role,state:existing.state},{headers:cors}); }
      const waiting = await env.DB.prepare("SELECT id,p1_id,p1_name FROM quiz_rooms WHERE state='waiting' LIMIT 1").first();
      if (waiting && waiting.p1_id !== pid) {
        const rs=now+3500, re=rs+8000;
        await env.DB.prepare('UPDATE quiz_rooms SET p2_id=?,p2_name=?,state=?,round_start=?,round_end=? WHERE id=?').bind(pid,name,'starting',rs,re,waiting.id).run();
        return Response.json({room_id:waiting.id,role:'p2',state:'starting',opp_name:waiting.p1_name},{headers:cors});
      }
      const countRow = await env.DB.prepare("SELECT COUNT(*) as c FROM quiz_rooms WHERE state!='done'").first();
      if ((countRow?.c||0)>=10) return Response.json({error:'伺服器已滿，請稍後再試'},{status:503,headers:cors});
      const id = Math.random().toString(36).slice(2,8).toUpperCase();
      const qidx = Math.floor(Math.random()*QUIZ_Q.length);
      await env.DB.prepare('INSERT INTO quiz_rooms (id,p1_id,p1_name,state,question_idx,created_at) VALUES (?,?,?,?,?,?)').bind(id,pid,name,'waiting',qidx,now).run();
      return Response.json({room_id:id,role:'p1',state:'waiting'},{headers:cors});
    }

    // GET /quiz/:id?pid=
    const quizGet = url.pathname.match(/^\/quiz\/([A-Z0-9]{6})$/);
    if (quizGet && request.method === 'GET') {
      const room_id=quizGet[1], pid=url.searchParams.get('pid')||'', now=Date.now();
      const room = await env.DB.prepare('SELECT * FROM quiz_rooms WHERE id=?').bind(room_id).first();
      if (!room) return Response.json({error:'room not found'},{status:404,headers:cors});
      let {state,round,p1_wins,p2_wins,round_start,round_end,p1_answer,p2_answer,question_idx,winner} = room;

      if (state==='starting' && now>=round_start) {
        state='answering'; round_end=round_start+8000;
        await env.DB.prepare("UPDATE quiz_rooms SET state='answering',round_end=? WHERE id=? AND state='starting'").bind(round_end,room_id).run();
      } else if (state==='answering') {
        const bothAnswered = p1_answer>0 && p2_answer>0;
        if (bothAnswered || now>=round_end) {
          const q = QUIZ_Q[question_idx%QUIZ_Q.length];
          const p1c = p1_answer-1, p2c = p2_answer-1; // convert to 0-indexed
          const p1right = p1_answer>0 && p1c===q.c, p2right = p2_answer>0 && p2c===q.c;
          if (p1right && !p2right) p1_wins++;
          else if (p2right && !p1right) p2_wins++;
          const reveal_end = now+3000;
          const maxWins = 3, total_rounds = 5;
          if (p1_wins>=maxWins || p2_wins>=maxWins || round>=total_rounds) {
            winner = p1_wins>p2_wins?'p1':p2_wins>p1_wins?'p2':'draw'; state='done';
            await env.DB.prepare("UPDATE quiz_rooms SET state='done',p1_wins=?,p2_wins=?,winner=? WHERE id=? AND state='answering'").bind(p1_wins,p2_wins,winner,room_id).run();
          } else {
            state='revealing'; round_start=reveal_end;
            await env.DB.prepare("UPDATE quiz_rooms SET state='revealing',round_start=?,p1_wins=?,p2_wins=? WHERE id=? AND state='answering'").bind(reveal_end,p1_wins,p2_wins,room_id).run();
          }
        }
      } else if (state==='revealing' && now>=round_start) {
        round++; const new_qidx=(question_idx+1)%QUIZ_Q.length, rs=now+3500, re=rs+8000;
        state='starting'; p1_answer=0; p2_answer=0; round_start=rs; round_end=re; question_idx=new_qidx;
        await env.DB.prepare("UPDATE quiz_rooms SET state='starting',round=?,question_idx=?,p1_answer=0,p2_answer=0,round_start=?,round_end=? WHERE id=? AND state='revealing'").bind(round,new_qidx,rs,re,room_id).run();
      }

      const role=room.p1_id===pid?'p1':'p2';
      const q=QUIZ_Q[question_idx%QUIZ_Q.length];
      const time_left = state==='answering'?Math.max(0,round_end-now):state==='starting'?Math.max(0,round_start-now):0;
      return Response.json({
        state, round, p1_wins, p2_wins, winner, role,
        p1_name:room.p1_name, p2_name:room.p2_name||null,
        question_idx, question:q.q, choices:q.a,
        correct_idx: (state==='revealing'||state==='done')?q.c:-1,
        p1_answer: (state==='revealing'||state==='done')?p1_answer:0,
        p2_answer: (state==='revealing'||state==='done')?p2_answer:0,
        time_left
      },{headers:cors});
    }

    // POST /quiz/:id/answer
    const quizAnswer = url.pathname.match(/^\/quiz\/([A-Z0-9]{6})\/answer$/);
    if (quizAnswer && request.method === 'POST') {
      const room_id=quizAnswer[1];
      let body; try { body=await request.json(); } catch { return Response.json({ok:false},{headers:cors}); }
      const pid=(body.pid||'').slice(0,40), answer=parseInt(body.answer)||0;
      if (answer<1||answer>4) return Response.json({ok:false},{headers:cors});
      const room = await env.DB.prepare('SELECT p1_id,p2_id,state,p1_answer,p2_answer FROM quiz_rooms WHERE id=?').bind(room_id).first();
      if (!room||room.state!=='answering') return Response.json({ok:false},{headers:cors});
      if (room.p1_id===pid && !room.p1_answer) {
        await env.DB.prepare('UPDATE quiz_rooms SET p1_answer=? WHERE id=?').bind(answer,room_id).run();
      } else if (room.p2_id===pid && !room.p2_answer) {
        await env.DB.prepare('UPDATE quiz_rooms SET p2_answer=? WHERE id=?').bind(answer,room_id).run();
      }
      return Response.json({ok:true},{headers:cors});
    }

    return env.ASSETS.fetch(request);
  }
};
