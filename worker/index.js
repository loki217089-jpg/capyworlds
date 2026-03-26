// v2.0 - Generic room system (/room/:type/*)

function rpsWinner(c1, c2) {
  if (c1 === c2) return 'draw';
  if ((c1==='rock'&&c2==='scissors')||(c1==='paper'&&c2==='rock')||(c1==='scissors'&&c2==='paper')) return 'p1';
  return 'p2';
}

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

// ── 通用房間遊戲定義（新增遊戲只需在此加一個 key）────────────────
const GAME_DEFS = {
  rps: {
    play_state: 'choosing', play_ms: 10000, reveal_ms: 2500,
    match_wins: 2, total_rounds: null,
    initData: () => ({ p1_choice:'', p2_choice:'' }),
    onAct(room, data, pid, body) {
      const c = body.choice;
      if (!['rock','paper','scissors'].includes(c)) return false;
      if (room.p1_id===pid && !data.p1_choice) { data.p1_choice=c; return true; }
      if (room.p2_id===pid && !data.p2_choice) { data.p2_choice=c; return true; }
      return false;
    },
    shouldEndRound: d => !!(d.p1_choice && d.p2_choice),
    roundWinner(d) {
      const c1=d.p1_choice||'forfeit', c2=d.p2_choice||'forfeit';
      if (c1==='forfeit'&&c2==='forfeit') return 'draw';
      if (c1==='forfeit') return 'p2';
      if (c2==='forfeit') return 'p1';
      return rpsWinner(c1, c2);
    },
    resetRound: () => ({ p1_choice:'', p2_choice:'' }),
    serialize(d, state) {
      const show = state==='revealing'||state==='done';
      return { p1_chosen:!!d.p1_choice, p2_chosen:!!d.p2_choice,
               p1_choice:show?d.p1_choice:'', p2_choice:show?d.p2_choice:'' };
    },
  },
  quiz: {
    play_state: 'answering', play_ms: 8000, reveal_ms: 3000,
    match_wins: 3, total_rounds: 5,
    initData: () => ({ p1_answer:0, p2_answer:0, question_idx:Math.floor(Math.random()*QUIZ_Q.length) }),
    onAct(room, data, pid, body) {
      const a = parseInt(body.answer);
      if (a<1||a>4) return false;
      if (room.p1_id===pid && !data.p1_answer) { data.p1_answer=a; return true; }
      if (room.p2_id===pid && !data.p2_answer) { data.p2_answer=a; return true; }
      return false;
    },
    shouldEndRound: d => !!(d.p1_answer && d.p2_answer),
    roundWinner(d) {
      const q=QUIZ_Q[d.question_idx%QUIZ_Q.length];
      const p1r=d.p1_answer>0&&(d.p1_answer-1)===q.c, p2r=d.p2_answer>0&&(d.p2_answer-1)===q.c;
      if (p1r&&!p2r) return 'p1'; if (p2r&&!p1r) return 'p2'; return 'draw';
    },
    resetRound: d => ({ p1_answer:0, p2_answer:0, question_idx:(d.question_idx+1)%QUIZ_Q.length }),
    serialize(d, state) {
      const q=QUIZ_Q[d.question_idx%QUIZ_Q.length], show=state==='revealing'||state==='done';
      return { question:q.q, choices:q.a, question_idx:d.question_idx,
               correct_idx:show?q.c:-1, p1_answer:show?d.p1_answer:0, p2_answer:show?d.p2_answer:0 };
    },
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // ── 留言 ──────────────────────────────────────────────────────
    if (url.pathname==='/comments' && request.method==='GET') {
      const {results}=await env.DB.prepare('SELECT id,name,content,created_at,parent_id FROM comments ORDER BY created_at ASC LIMIT 200').all();
      return Response.json(results,{headers:cors});
    }
    if (url.pathname==='/comments' && request.method==='POST') {
      let b; try{b=await request.json();}catch{return Response.json({error:'格式錯誤'},{status:400,headers:cors});}
      const name=(b.name||'').trim().slice(0,50), content=(b.content||'').trim().slice(0,500);
      const parent_id=b.parent_id?parseInt(b.parent_id):null;
      if (!name||!content) return Response.json({error:'請填寫名稱和留言'},{status:400,headers:cors});
      await env.DB.prepare('INSERT INTO comments (name,content,created_at,parent_id) VALUES (?,?,?,?)').bind(name,content,new Date().toISOString(),parent_id).run();
      return Response.json({ok:true},{headers:cors});
    }
    const delM=url.pathname.match(/^\/comments\/(\d+)$/);
    if (delM && request.method==='DELETE') {
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if (!env.ADMIN_KEY||auth!==env.ADMIN_KEY) return Response.json({error:'權限不足'},{status:401,headers:cors});
      const id=parseInt(delM[1]);
      await env.DB.prepare('DELETE FROM comments WHERE parent_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM comments WHERE id=?').bind(id).run();
      return Response.json({ok:true},{headers:cors});
    }

    // ── 排行榜 ────────────────────────────────────────────────────
    const lbM=url.pathname.match(/^\/leaderboard\/([a-z0-9_-]+)$/);
    if (lbM && request.method==='GET') {
      const {results}=await env.DB.prepare('SELECT name,score,created_at FROM scores WHERE game=? ORDER BY score DESC LIMIT 10').bind(lbM[1]).all();
      return Response.json(results,{headers:cors});
    }
    if (lbM && request.method==='POST') {
      let b; try{b=await request.json();}catch{return Response.json({error:'格式錯誤'},{status:400,headers:cors});}
      const name=(b.name||'').trim().slice(0,30), score=parseInt(b.score);
      if (!name||isNaN(score)||score<0) return Response.json({error:'請填寫名稱與有效分數'},{status:400,headers:cors});
      await env.DB.prepare('INSERT INTO scores (game,name,score,created_at) VALUES (?,?,?,?)').bind(lbM[1],name,score,new Date().toISOString()).run();
      return Response.json({ok:true},{headers:cors});
    }

    // ── 彈幕 ──────────────────────────────────────────────────────
    if (url.pathname==='/danmaku' && request.method==='GET') {
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if (url.searchParams.get('admin')==='1' && auth==='66520') {
        const {results}=await env.DB.prepare('SELECT id,text,color,created_at FROM danmaku ORDER BY id DESC LIMIT 100').all();
        return Response.json(results,{headers:cors});
      }
      const since=parseInt(url.searchParams.get('since')||'0');
      const {results}=await env.DB.prepare('SELECT id,text,color,created_at FROM danmaku WHERE id>? ORDER BY id ASC LIMIT 60').bind(since).all();
      return Response.json(results,{headers:cors});
    }
    if (url.pathname==='/danmaku' && request.method==='POST') {
      let b; try{b=await request.json();}catch{return Response.json({error:'格式錯誤'},{status:400,headers:cors});}
      const text=(b.text||'').trim().slice(0,40);
      const allowed=['#ffffff','#ffd700','#00ffff','#ff69b4','#7fff00','#ff6347'];
      const color=allowed.includes(b.color)?b.color:'#ffffff';
      if (!text) return Response.json({error:'彈幕不能為空'},{status:400,headers:cors});
      await env.DB.prepare('INSERT INTO danmaku (text,color,created_at) VALUES (?,?,?)').bind(text,color,new Date().toISOString()).run();
      return Response.json({ok:true},{headers:cors});
    }
    if (url.pathname==='/danmaku/all' && request.method==='DELETE') {
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if (auth!=='66520') return Response.json({error:'未授權'},{status:401,headers:cors});
      await env.DB.prepare('DELETE FROM danmaku').run();
      return Response.json({ok:true},{headers:cors});
    }
    const dmDel=url.pathname.match(/^\/danmaku\/(\d+)$/);
    if (dmDel && request.method==='DELETE') {
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if (auth!=='66520') return Response.json({error:'未授權'},{status:401,headers:cors});
      await env.DB.prepare('DELETE FROM danmaku WHERE id=?').bind(parseInt(dmDel[1])).run();
      return Response.json({ok:true},{headers:cors});
    }

    // ── 水豚拔河 Match API ────────────────────────────────────────
    if (url.pathname==='/match/join' && request.method==='POST') {
      let b; try{b=await request.json();}catch{return Response.json({error:'bad request'},{status:400,headers:cors});}
      const pid=(b.pid||'').slice(0,40), name=(b.name||'玩家').trim().slice(0,20)||'玩家';
      if (!pid) return Response.json({error:'pid required'},{status:400,headers:cors});
      const now=Date.now();
      await env.DB.prepare('DELETE FROM match_rooms WHERE created_at<?').bind(now-600000).run();
      const ex=await env.DB.prepare("SELECT id,p1_id,p2_id,state FROM match_rooms WHERE (p1_id=? OR p2_id=?) AND state!='done' LIMIT 1").bind(pid,pid).first();
      if (ex) return Response.json({room_id:ex.id,role:ex.p1_id===pid?'p1':'p2',state:ex.state},{headers:cors});
      const wait=await env.DB.prepare("SELECT id,p1_id,p1_name FROM match_rooms WHERE state='waiting' LIMIT 1").first();
      if (wait && wait.p1_id!==pid) {
        const rs=now+3500, re=rs+30000;
        await env.DB.prepare('UPDATE match_rooms SET p2_id=?,p2_name=?,state=?,round_start=?,round_end=? WHERE id=?').bind(pid,name,'starting',rs,re,wait.id).run();
        return Response.json({room_id:wait.id,role:'p2',state:'starting',opp_name:wait.p1_name},{headers:cors});
      }
      const cnt=await env.DB.prepare("SELECT COUNT(*) as c FROM match_rooms WHERE state!='done'").first();
      if ((cnt?.c||0)>=10) return Response.json({error:'伺服器已滿，請稍後再試'},{status:503,headers:cors});
      const id=Math.random().toString(36).slice(2,8).toUpperCase();
      await env.DB.prepare('INSERT INTO match_rooms (id,p1_id,p1_name,state,created_at) VALUES (?,?,?,?,?)').bind(id,pid,name,'waiting',now).run();
      return Response.json({room_id:id,role:'p1',state:'waiting'},{headers:cors});
    }

    const matchGet=url.pathname.match(/^\/match\/([A-Z0-9]{6})$/);
    if (matchGet && request.method==='GET') {
      const room_id=matchGet[1], pid=url.searchParams.get('pid')||'', now=Date.now();
      const room=await env.DB.prepare('SELECT * FROM match_rooms WHERE id=?').bind(room_id).first();
      if (!room) return Response.json({error:'room not found'},{status:404,headers:cors});
      let {state,round,p1_wins,p2_wins,round_start,round_end,p1_taps,p2_taps,winner}=room;
      if (state==='starting'&&now>=round_start) {
        state='playing';
        await env.DB.prepare("UPDATE match_rooms SET state='playing' WHERE id=? AND state='starting'").bind(room_id).run();
      } else if (state==='playing') {
        const rp=Math.max(0,Math.min(100,50-(p1_taps-p2_taps)*0.6));
        const earlyWin=rp<=0?'p1':rp>=100?'p2':null;
        if (earlyWin||now>=round_end) {
          let rw=earlyWin||(p1_taps>=p2_taps?'p1':'p2');
          if (rw==='p1') p1_wins++; else p2_wins++;
          if (p1_wins>=2||p2_wins>=2) {
            state='done'; winner=p1_wins>=2?'p1':'p2';
            await env.DB.prepare("UPDATE match_rooms SET state='done',p1_wins=?,p2_wins=?,winner=? WHERE id=? AND state='playing'").bind(p1_wins,p2_wins,winner,room_id).run();
          } else {
            round++; const ns=now+3500,ne=ns+30000; state='starting';
            await env.DB.prepare("UPDATE match_rooms SET state='starting',round=?,p1_wins=?,p2_wins=?,p1_taps=0,p2_taps=0,round_start=?,round_end=? WHERE id=? AND state='playing'").bind(round,p1_wins,p2_wins,ns,ne,room_id).run();
            p1_taps=0; p2_taps=0; round_start=ns; round_end=ne;
          }
        }
      }
      const rope_pos=Math.max(0,Math.min(100,50-(p1_taps-p2_taps)*0.6));
      const role=room.p1_id===pid?'p1':'p2';
      const time_left=state==='playing'?Math.max(0,round_end-now):state==='starting'?Math.max(0,round_start-now):0;
      return Response.json({state,round,p1_wins,p2_wins,rope_pos,winner,role,p1_name:room.p1_name,p2_name:room.p2_name||null,time_left,p1_taps,p2_taps},{headers:cors});
    }

    const matchTap=url.pathname.match(/^\/match\/([A-Z0-9]{6})\/tap$/);
    if (matchTap && request.method==='POST') {
      const room_id=matchTap[1];
      let b; try{b=await request.json();}catch{return Response.json({ok:false},{headers:cors});}
      const pid=(b.pid||'').slice(0,40), taps=Math.max(0,Math.min(99999,parseInt(b.taps)||0));
      const room=await env.DB.prepare('SELECT p1_id,state FROM match_rooms WHERE id=?').bind(room_id).first();
      if (!room||room.state!=='playing') return Response.json({ok:false},{headers:cors});
      if (room.p1_id===pid) await env.DB.prepare('UPDATE match_rooms SET p1_taps=? WHERE id=?').bind(taps,room_id).run();
      else await env.DB.prepare('UPDATE match_rooms SET p2_taps=? WHERE id=?').bind(taps,room_id).run();
      return Response.json({ok:true},{headers:cors});
    }

    // ── 通用遊戲房間 API (/room/:type/*) ─────────────────────────
    // POST /room/:type/join
    const roomJoin=url.pathname.match(/^\/room\/([a-z]+)\/join$/);
    if (roomJoin && request.method==='POST') {
      const type=roomJoin[1], def=GAME_DEFS[type];
      if (!def) return Response.json({error:'unknown game type'},{status:404,headers:cors});
      let b; try{b=await request.json();}catch{return Response.json({error:'bad request'},{status:400,headers:cors});}
      const pid=(b.pid||'').slice(0,40), name=(b.name||'玩家').trim().slice(0,20)||'玩家';
      if (!pid) return Response.json({error:'pid required'},{status:400,headers:cors});
      const now=Date.now();
      await env.DB.prepare('DELETE FROM game_rooms WHERE game_type=? AND created_at<?').bind(type,now-600000).run();
      const ex=await env.DB.prepare("SELECT id,p1_id,p2_id,state FROM game_rooms WHERE game_type=? AND (p1_id=? OR p2_id=?) AND state!='done' LIMIT 1").bind(type,pid,pid).first();
      if (ex) return Response.json({room_id:ex.id,role:ex.p1_id===pid?'p1':'p2',state:ex.state},{headers:cors});
      const wait=await env.DB.prepare("SELECT id,p1_id,p1_name FROM game_rooms WHERE game_type=? AND state='waiting' LIMIT 1").bind(type).first();
      if (wait && wait.p1_id!==pid) {
        const rs=now+3500, re=rs+def.play_ms;
        await env.DB.prepare('UPDATE game_rooms SET p2_id=?,p2_name=?,state=?,round_start=?,round_end=? WHERE id=?').bind(pid,name,'starting',rs,re,wait.id).run();
        return Response.json({room_id:wait.id,role:'p2',state:'starting',opp_name:wait.p1_name},{headers:cors});
      }
      const cnt=await env.DB.prepare("SELECT COUNT(*) as c FROM game_rooms WHERE game_type=? AND state!='done'").bind(type).first();
      if ((cnt?.c||0)>=10) return Response.json({error:'伺服器已滿，請稍後再試'},{status:503,headers:cors});
      const id=Math.random().toString(36).slice(2,8).toUpperCase();
      const initData=JSON.stringify(def.initData());
      await env.DB.prepare('INSERT INTO game_rooms (id,game_type,p1_id,p1_name,state,data,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,type,pid,name,'waiting',initData,now).run();
      return Response.json({room_id:id,role:'p1',state:'waiting'},{headers:cors});
    }

    // GET /room/:type/:id?pid=
    const roomGet=url.pathname.match(/^\/room\/([a-z]+)\/([A-Z0-9]{6})$/);
    if (roomGet && request.method==='GET') {
      const type=roomGet[1], room_id=roomGet[2], def=GAME_DEFS[type];
      if (!def) return Response.json({error:'unknown game type'},{status:404,headers:cors});
      const pid=url.searchParams.get('pid')||'', now=Date.now();
      const room=await env.DB.prepare('SELECT * FROM game_rooms WHERE id=? AND game_type=?').bind(room_id,type).first();
      if (!room) return Response.json({error:'room not found'},{status:404,headers:cors});
      let {state,round,p1_wins,p2_wins,round_start,round_end,winner}=room;
      let data=JSON.parse(room.data||'{}');

      if (state==='starting' && now>=round_start) {
        state=def.play_state; round_end=round_start+def.play_ms;
        await env.DB.prepare('UPDATE game_rooms SET state=?,round_end=? WHERE id=? AND state=?').bind(state,round_end,room_id,'starting').run();
      } else if (state===def.play_state) {
        if (def.shouldEndRound(data)||now>=round_end) {
          const rw=def.roundWinner(data);
          if (rw==='p1') p1_wins++; else if (rw==='p2') p2_wins++;
          const reveal_end=now+def.reveal_ms;
          const matchOver=(def.match_wins&&(p1_wins>=def.match_wins||p2_wins>=def.match_wins))||(def.total_rounds&&round>=def.total_rounds);
          if (matchOver) {
            winner=p1_wins>p2_wins?'p1':p2_wins>p1_wins?'p2':'draw'; state='done';
            await env.DB.prepare('UPDATE game_rooms SET state=?,p1_wins=?,p2_wins=?,winner=? WHERE id=? AND state=?').bind('done',p1_wins,p2_wins,winner,room_id,def.play_state).run();
          } else {
            state='revealing'; round_start=reveal_end;
            await env.DB.prepare('UPDATE game_rooms SET state=?,round_start=?,p1_wins=?,p2_wins=? WHERE id=? AND state=?').bind('revealing',reveal_end,p1_wins,p2_wins,room_id,def.play_state).run();
          }
        }
      } else if (state==='revealing' && now>=round_start) {
        round++; const rs=now+3500, re=rs+def.play_ms;
        const newData={...data,...def.resetRound(data)};
        state='starting'; round_start=rs; round_end=re;
        await env.DB.prepare('UPDATE game_rooms SET state=?,round=?,data=?,round_start=?,round_end=? WHERE id=? AND state=?').bind('starting',round,JSON.stringify(newData),rs,re,room_id,'revealing').run();
        data=newData;
      }

      const role=room.p1_id===pid?'p1':'p2';
      const time_left=state===def.play_state?Math.max(0,round_end-now):state==='starting'?Math.max(0,round_start-now):0;
      return Response.json({
        state, round, p1_wins, p2_wins, winner, role,
        p1_name:room.p1_name, p2_name:room.p2_name||null, time_left,
        ...def.serialize(data, state),
      },{headers:cors});
    }

    // POST /room/:type/:id/act
    const roomAct=url.pathname.match(/^\/room\/([a-z]+)\/([A-Z0-9]{6})\/act$/);
    if (roomAct && request.method==='POST') {
      const type=roomAct[1], room_id=roomAct[2], def=GAME_DEFS[type];
      if (!def) return Response.json({ok:false},{headers:cors});
      let b; try{b=await request.json();}catch{return Response.json({ok:false},{headers:cors});}
      const pid=(b.pid||'').slice(0,40);
      const room=await env.DB.prepare('SELECT p1_id,p2_id,state,data FROM game_rooms WHERE id=? AND game_type=?').bind(room_id,type).first();
      if (!room||room.state!==def.play_state) return Response.json({ok:false},{headers:cors});
      const data=JSON.parse(room.data||'{}');
      if (!def.onAct(room,data,pid,b)) return Response.json({ok:false},{headers:cors});
      await env.DB.prepare('UPDATE game_rooms SET data=? WHERE id=?').bind(JSON.stringify(data),room_id).run();
      return Response.json({ok:true},{headers:cors});
    }

    // ── 1對1情境聊天室 ────────────────────────────────────────────
    // POST /chat/join  { pid, name, gender }
    if (url.pathname==='/chat/join' && request.method==='POST') {
      let b; try{b=await request.json();}catch{return Response.json({error:'bad request'},{status:400,headers:cors});}
      const pid=(b.pid||'').slice(0,40), name=(b.name||'').trim().slice(0,20)||'匿名', gender=b.gender;
      if (!pid||!['male','female'].includes(gender)) return Response.json({error:'pid/gender required'},{status:400,headers:cors});
      // ensure tables exist (idempotent)
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS chat_rooms (id TEXT PRIMARY KEY, p1_id TEXT NOT NULL, p2_id TEXT, p1_name TEXT NOT NULL, p2_name TEXT, p1_gender TEXT NOT NULL, p2_gender TEXT, state TEXT NOT NULL DEFAULT 'waiting', scenario_id INTEGER NOT NULL DEFAULT 0, scenario_req TEXT, timer_end INTEGER, created_at INTEGER NOT NULL)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL, msg_type TEXT NOT NULL DEFAULT 'text', content TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_cm_room ON chat_messages(room_id, id)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_cr_state ON chat_rooms(state)").run();
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p1_ping INTEGER DEFAULT 0").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p2_ping INTEGER DEFAULT 0").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p1_ip TEXT DEFAULT ''").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p1_country TEXT DEFAULT ''").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p1_ua TEXT DEFAULT ''").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p2_ip TEXT DEFAULT ''").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p2_country TEXT DEFAULT ''").run(); } catch(e){}
      try { await env.DB.prepare("ALTER TABLE chat_rooms ADD COLUMN p2_ua TEXT DEFAULT ''").run(); } catch(e){}
      const now=Date.now();
      const joinIp=request.headers.get('CF-Connecting-IP')||'';
      const joinCountry=request.headers.get('CF-IPCountry')||'';
      const joinUa=request.headers.get('User-Agent')||'';
      // clean up stale rooms
      await env.DB.prepare("DELETE FROM chat_rooms WHERE created_at<?").bind(now-3600000).run();
      // check if already in an active room
      const ex=await env.DB.prepare("SELECT id,p1_id,p2_id,state FROM chat_rooms WHERE (p1_id=? OR p2_id=?) AND state NOT IN ('done','cancelled') LIMIT 1").bind(pid,pid).first();
      if (ex) return Response.json({room_id:ex.id,role:ex.p1_id===pid?'p1':'p2',state:ex.state},{headers:cors});
      // find opposite gender waiting room（跳過殭屍：60秒內沒ping且建立超過60秒）
      const opp=gender==='male'?'female':'male';
      const wait=await env.DB.prepare("SELECT id,p1_id,p1_name FROM chat_rooms WHERE state='waiting' AND p1_gender=? AND NOT(p1_ping=0 AND created_at<?) AND (p1_ping=0 OR p1_ping>?) LIMIT 1").bind(opp,now-60000,now-90000).first();
      if (wait && wait.p1_id!==pid) {
        const timer_end=now+300000;
        // conditional UPDATE to prevent race condition + include IP/country/UA
        const upd=await env.DB.prepare("UPDATE chat_rooms SET p2_id=?,p2_name=?,p2_gender=?,state='chatting',timer_end=?,p2_ip=?,p2_country=?,p2_ua=? WHERE id=? AND state='waiting'").bind(pid,name,gender,timer_end,joinIp,joinCountry,joinUa,wait.id).run();
        if ((upd.meta?.changes||0)>0) {
          return Response.json({room_id:wait.id,role:'p2',state:'chatting',opp_name:wait.p1_name},{headers:cors});
        }
        // another user grabbed that room first — fall through to create new waiting room
      }
      const cnt=await env.DB.prepare("SELECT COUNT(*) as c FROM chat_rooms WHERE state='waiting'").first();
      if ((cnt?.c||0)>=20) return Response.json({error:'等待人數已滿，請稍後再試'},{status:503,headers:cors});
      const id=Math.random().toString(36).slice(2,8).toUpperCase();
      await env.DB.prepare("INSERT INTO chat_rooms (id,p1_id,p1_name,p1_gender,state,created_at,p1_ip,p1_country,p1_ua) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,pid,name,gender,'waiting',now,joinIp,joinCountry,joinUa).run();
      return Response.json({room_id:id,role:'p1',state:'waiting'},{headers:cors});
    }

    // GET /chat/:id?pid=
    const chatGet=url.pathname.match(/^\/chat\/([A-Z0-9]{6})$/);
    if (chatGet && request.method==='GET') {
      const room_id=chatGet[1], pid=url.searchParams.get('pid')||'', last_msg=parseInt(url.searchParams.get('last')||'0');
      const now=Date.now();
      const room=await env.DB.prepare('SELECT * FROM chat_rooms WHERE id=?').bind(room_id).first();
      if (!room) return Response.json({error:'room not found'},{status:404,headers:cors});
      // 更新自己的心跳
      const role=room.p1_id===pid?'p1':'p2';
      if (role==='p1') { try{await env.DB.prepare("UPDATE chat_rooms SET p1_ping=? WHERE id=?").bind(now,room_id).run();}catch(e){} }
      if (role==='p2') { try{await env.DB.prepare("UPDATE chat_rooms SET p2_ping=? WHERE id=?").bind(now,room_id).run();}catch(e){} }
      let {state,timer_end}=room;
      if (state==='chatting' && timer_end && now>=timer_end) {
        state='done';
        await env.DB.prepare("UPDATE chat_rooms SET state='done' WHERE id=? AND state='chatting'").bind(room_id).run();
      }
      const msgs=await env.DB.prepare('SELECT id,role,name,msg_type,content,created_at FROM chat_messages WHERE room_id=? AND id>? ORDER BY id ASC LIMIT 80').bind(room_id,last_msg).all();
      // 判斷對方是否在線（90秒內有ping）
      const oppPing = role==='p1'? room.p2_ping : room.p1_ping;
      const opp_online = oppPing && oppPing > now-90000;
      return Response.json({
        state, role, scenario_id:room.scenario_id, scenario_req:room.scenario_req?JSON.parse(room.scenario_req):null,
        p1_name:room.p1_name, p2_name:room.p2_name||null,
        p1_gender:room.p1_gender, p2_gender:room.p2_gender||null,
        time_left:state==='chatting'?Math.max(0,timer_end-now):0,
        messages:(msgs.results||[]),
        opp_online: !!opp_online,
      },{headers:cors});
    }

    // POST /chat/:id/leave  { pid }
    const chatLeave=url.pathname.match(/^\/chat\/([A-Z0-9]{6})\/leave$/);
    if (chatLeave && request.method==='POST') {
      const room_id=chatLeave[1];
      let b; try{b=await request.json();}catch{b={};}
      const pid=(b.pid||'').slice(0,40);
      const room=await env.DB.prepare("SELECT p1_id,p2_id,state FROM chat_rooms WHERE id=?").bind(room_id).first();
      if (!room) return Response.json({ok:true},{headers:cors});
      const isP1=room.p1_id===pid, isP2=room.p2_id===pid;
      if (!isP1 && !isP2) return Response.json({ok:true},{headers:cors});
      if (room.state==='waiting' && isP1) {
        await env.DB.prepare("UPDATE chat_rooms SET state='done' WHERE id=?").bind(room_id).run();
      } else if (room.state==='chatting') {
        // one side left → mark done so other side's poll detects it
        await env.DB.prepare("UPDATE chat_rooms SET state='done' WHERE id=?").bind(room_id).run();
      }
      return Response.json({ok:true},{headers:cors});
    }

    // POST /chat/:id/msg  { pid, type, content }
    const chatMsg=url.pathname.match(/^\/chat\/([A-Z0-9]{6})\/msg$/);
    if (chatMsg && request.method==='POST') {
      const room_id=chatMsg[1];
      let b; try{b=await request.json();}catch{return Response.json({ok:false},{headers:cors});}
      const pid=(b.pid||'').slice(0,40);
      const room=await env.DB.prepare("SELECT p1_id,p2_id,p1_name,p2_name,state FROM chat_rooms WHERE id=?").bind(room_id).first();
      if (!room||room.state!=='chatting') return Response.json({ok:false,error:'not in chat'},{headers:cors});
      const role=room.p1_id===pid?'p1':room.p2_id===pid?'p2':null;
      if (!role) return Response.json({ok:false},{headers:cors});
      const name=role==='p1'?room.p1_name:room.p2_name;
      const msg_type=['text','sticker'].includes(b.type)?b.type:'text';
      const content=(b.content||'').trim().slice(0,200);
      if (!content) return Response.json({ok:false},{headers:cors});
      await env.DB.prepare('INSERT INTO chat_messages (room_id,role,name,msg_type,content,created_at) VALUES (?,?,?,?,?,?)').bind(room_id,role,name,msg_type,content,Date.now()).run();
      return Response.json({ok:true},{headers:cors});
    }

    // POST /chat/:id/leave  { pid }
    const chatLeave=url.pathname.match(/^\/chat\/([A-Z0-9]{6})\/leave$/);
    if (chatLeave && request.method==='POST') {
      const room_id=chatLeave[1];
      let b; try{b=await request.json();}catch{b={};}
      const pid=(b.pid||'').slice(0,40);
      const room=await env.DB.prepare("SELECT p1_id,p2_id,state FROM chat_rooms WHERE id=?").bind(room_id).first();
      if (!room) return Response.json({ok:false},{headers:cors});
      if (room.state==='waiting' && room.p1_id===pid) {
        await env.DB.prepare("DELETE FROM chat_rooms WHERE id=?").bind(room_id).run();
      } else if (room.state==='chatting') {
        await env.DB.prepare("UPDATE chat_rooms SET state='done' WHERE id=?").bind(room_id).run();
      }
      return Response.json({ok:true},{headers:cors});
    }

    // POST /chat/:id/scene  { pid, action, scene_id }
    const chatScene=url.pathname.match(/^\/chat\/([A-Z0-9]{6})\/scene$/);
    if (chatScene && request.method==='POST') {
      const room_id=chatScene[1];
      let b; try{b=await request.json();}catch{return Response.json({ok:false},{headers:cors});}
      const pid=(b.pid||'').slice(0,40), action=b.action;
      const room=await env.DB.prepare("SELECT p1_id,p2_id,state,scenario_req FROM chat_rooms WHERE id=?").bind(room_id).first();
      if (!room||room.state!=='chatting') return Response.json({ok:false},{headers:cors});
      const role=room.p1_id===pid?'p1':room.p2_id===pid?'p2':null;
      if (!role) return Response.json({ok:false},{headers:cors});
      if (action==='propose') {
        const scene_id=parseInt(b.scene_id)||0;
        if (scene_id<1||scene_id>6) return Response.json({ok:false},{headers:cors});
        const req=JSON.stringify({proposer:role,scene_id});
        await env.DB.prepare("UPDATE chat_rooms SET scenario_req=? WHERE id=?").bind(req,room_id).run();
        return Response.json({ok:true},{headers:cors});
      }
      if (action==='accept') {
        const req=room.scenario_req?JSON.parse(room.scenario_req):null;
        if (!req||req.proposer===role) return Response.json({ok:false},{headers:cors});
        await env.DB.prepare("UPDATE chat_rooms SET scenario_id=?,scenario_req=NULL WHERE id=?").bind(req.scene_id,room_id).run();
        return Response.json({ok:true},{headers:cors});
      }
      if (action==='reject') {
        await env.DB.prepare("UPDATE chat_rooms SET scenario_req=NULL WHERE id=?").bind(room_id).run();
        return Response.json({ok:true},{headers:cors});
      }
      return Response.json({ok:false},{headers:cors});
    }

    // DELETE /chat/admin/:room_id  (強制關閉房間)
    const adminClose=url.pathname.match(/^\/chat\/admin\/([A-Z0-9]{6})$/);
    if (adminClose && request.method==='DELETE') {
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if (!env.ADMIN_KEY||auth!==env.ADMIN_KEY) return Response.json({error:'unauthorized'},{status:401,headers:cors});
      const room_id=adminClose[1];
      await env.DB.prepare("UPDATE chat_rooms SET state='done' WHERE id=? AND state!='done'").bind(room_id).run();
      return Response.json({ok:true},{headers:cors});
    }

    // GET /chat/admin  (requires Authorization: Bearer {ADMIN_KEY})
    if (url.pathname==='/chat/admin' && request.method==='GET') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const auth=(request.headers.get('Authorization')||'').replace('Bearer ','');
      const now=Date.now();
      const twTime = new Date(now+8*3600000).toISOString().replace('T',' ').slice(0,19)+' (台灣)';

      // 建立登入紀錄表（首次）
      try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_login_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, success INTEGER, created_at INTEGER)").run(); } catch(e){}

      // 暴力破解防護：10分鐘內同 IP 失敗 >= 5 次 → 封鎖
      let failCount=0;
      try {
        const fr=await env.DB.prepare("SELECT COUNT(*) as n FROM admin_login_log WHERE ip=? AND success=0 AND created_at>?").bind(ip,now-600000).first();
        failCount=fr?fr.n:0;
      } catch(e){}
      if (failCount>=5) {
        if(env.DISCORD_WEBHOOK) { try { await fetch(env.DISCORD_WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`🚫 **後台封鎖警告** | IP \`${ip}\` 短時間嘗試 ${failCount} 次，已鎖定 | ${twTime}`})}); } catch(e){} }
        return Response.json({error:'too many attempts, blocked 10min'},{status:429,headers:cors});
      }

      if (!env.ADMIN_KEY||auth!==env.ADMIN_KEY) {
        // 記錄失敗
        try { await env.DB.prepare("INSERT INTO admin_login_log (ip,success,created_at) VALUES (?,0,?)").bind(ip,now).run(); } catch(e){}
        const newFail=failCount+1;
        if(newFail>=3 && env.DISCORD_WEBHOOK) { try { await fetch(env.DISCORD_WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`⚠️ **後台登入失敗** | IP \`${ip}\` 第 ${newFail} 次錯誤 | ${twTime}`})}); } catch(e){} }
        return Response.json({error:'unauthorized'},{status:401,headers:cors});
      }

      // 登入成功
      try { await env.DB.prepare("INSERT INTO admin_login_log (ip,success,created_at) VALUES (?,1,?)").bind(ip,now).run(); } catch(e){}
      if(env.DISCORD_WEBHOOK) { try { await fetch(env.DISCORD_WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`✅ **後台登入成功** | IP \`${ip}\` | ${twTime}`})}); } catch(e){} }

      let rooms=[], totalWaiting=0, totalChatting=0;
      try {
        const res=await env.DB.prepare("SELECT * FROM chat_rooms WHERE created_at>? ORDER BY created_at DESC").bind(now-3600000).all();
        for (const room of (res.results||[])) {
          if(room.state==='waiting') totalWaiting++;
          if(room.state==='chatting') totalChatting++;
          let msgs=[];
          try {
            const mr=await env.DB.prepare("SELECT id,role,name,msg_type,content,created_at FROM chat_messages WHERE room_id=? ORDER BY id DESC LIMIT 30").bind(room.id).all();
            msgs=(mr.results||[]).reverse();
          } catch(e){}
          rooms.push({...room, messages:msgs});
        }
      } catch(e){ return Response.json({error:'tables not yet created, no chats yet'},{headers:cors}); }
      return Response.json({rooms,totalWaiting,totalChatting,now},{headers:cors});
    }

    // ── 社群趨勢代理 (/trends/:source) ────────────────────────────
    if (url.pathname==='/trends/google' && request.method==='GET') {
      try {
        const r=await fetch('https://trends.google.com.tw/trending/rss?geo=TW',{headers:{'User-Agent':'Mozilla/5.0'}});
        const xml=await r.text();
        return new Response(xml,{headers:{...cors,'Content-Type':'application/xml;charset=utf-8'}});
      } catch(e){ return Response.json({error:'fetch failed'},{status:502,headers:cors}); }
    }
    if (url.pathname==='/trends/dcard' && request.method==='GET') {
      try {
        const r=await fetch('https://www.dcard.tw/service/api/v2/posts?popular=true&limit=30',{headers:{'User-Agent':'Mozilla/5.0'}});
        const data=await r.json();
        return Response.json(data,{headers:cors});
      } catch(e){ return Response.json({error:'fetch failed'},{status:502,headers:cors}); }
    }
    if (url.pathname==='/trends/ptt' && request.method==='GET') {
      try {
        const r=await fetch('https://www.ptt.cc/bbs/hotboards.html',{headers:{'User-Agent':'Mozilla/5.0','Cookie':'over18=1'}});
        const html=await r.text();
        return new Response(html,{headers:{...cors,'Content-Type':'text/html;charset=utf-8'}});
      } catch(e){ return Response.json({error:'fetch failed'},{status:502,headers:cors}); }
    }
    if (url.pathname==='/trends/yahoo' && request.method==='GET') {
      try {
        const r=await fetch('https://tw.news.yahoo.com/rss/',{headers:{'User-Agent':'Mozilla/5.0'}});
        const xml=await r.text();
        return new Response(xml,{headers:{...cors,'Content-Type':'application/xml;charset=utf-8'}});
      } catch(e){ return Response.json({error:'fetch failed'},{status:502,headers:cors}); }
    }

    return env.ASSETS.fetch(request);
  }
};
