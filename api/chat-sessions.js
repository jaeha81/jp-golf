import { neon } from '@neondatabase/serverless';
import { timingSafeEqual } from 'node:crypto';

const json = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body));
const clean = (value, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const database = () => process.env.DATABASE_URL?.trim() ? neon(process.env.DATABASE_URL.trim()) : null;

function adminAuthorized(req) {
  const expected = process.env.ADMIN_QUEUE_TOKEN?.trim();
  const actual = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!expected || !actual) return false;
  const left = Buffer.from(actual), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}

async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id UUID PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', region TEXT,
    golf_date DATE, stay_end_date DATE, players INTEGER, budget_per_person INTEGER,
    request_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY, session_id UUID NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'system')), content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx ON chat_messages (session_id, created_at)`;
}

export default async function handler(req, res) {
  const sql = database();
  if (!sql) return json(res, 503, { error: '상담 세션 저장소가 연결되지 않았습니다.' });
  try {
    await ensureTables(sql);
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const id = sessionId(body?.sessionId), role = clean(body?.role, 10), content = clean(body?.content);
      if (!id || !['user', 'ai', 'system'].includes(role) || !content) return json(res, 400, { error: '상담 메시지 형식이 올바르지 않습니다.' });
      await sql`INSERT INTO chat_sessions (session_id) VALUES (${id}::uuid) ON CONFLICT (session_id) DO UPDATE SET updated_at=NOW()`;
      const result = await sql`INSERT INTO chat_messages (session_id, role, content) VALUES (${id}::uuid, ${role}, ${content}) RETURNING id, created_at`;
      return json(res, 201, { message: result[0] });
    }
    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const id = sessionId(body?.sessionId);
      if (!id) return json(res, 400, { error: '상담 세션 ID가 올바르지 않습니다.' });
      const region = clean(body?.region, 80), golfDate = clean(body?.golfDate, 10), stayEndDate = clean(body?.stayEndDate, 10);
      const players = Number(body?.players), budget = Number(body?.budgetPerPerson);
      if (golfDate && !/^\d{4}-\d{2}-\d{2}$/.test(golfDate)) return json(res, 400, { error: '희망 날짜 형식이 올바르지 않습니다.' });
      if (stayEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(stayEndDate)) return json(res, 400, { error: '귀국 날짜 형식이 올바르지 않습니다.' });
      await sql`INSERT INTO chat_sessions (session_id, region, golf_date, stay_end_date, players, budget_per_person)
        VALUES (${id}::uuid, ${region || null}, ${golfDate || null}, ${stayEndDate || null}, ${Number.isInteger(players) ? players : null}, ${Number.isInteger(budget) ? budget : null})
        ON CONFLICT (session_id) DO UPDATE SET region=${region || null}, golf_date=${golfDate || null}, stay_end_date=${stayEndDate || null}, players=${Number.isInteger(players) ? players : null}, budget_per_person=${Number.isInteger(budget) ? budget : null}, updated_at=NOW()`;
      return json(res, 200, { sessionId: id });
    }
    if (req.method === 'GET') {
      if (!adminAuthorized(req)) return json(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' });
      const id = sessionId(req.query?.sessionId || new URL(req.url || '/', 'https://jp-golf.vercel.app').searchParams.get('sessionId'));
      if (id) {
        const messages = await sql`SELECT role, content, created_at FROM chat_messages WHERE session_id=${id}::uuid ORDER BY created_at ASC, id ASC LIMIT 300`;
        return json(res, 200, { sessionId: id, messages });
      }
      const sessions = await sql`SELECT s.session_id, s.status, s.region, s.golf_date, s.stay_end_date, s.players, s.budget_per_person, s.request_id, s.created_at, s.updated_at, COUNT(m.id)::int AS message_count
        FROM chat_sessions s LEFT JOIN chat_messages m ON m.session_id=s.session_id GROUP BY s.session_id ORDER BY s.updated_at DESC LIMIT 200`;
      return json(res, 200, { sessions });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return json(res, 405, { error: '허용하지 않는 메서드입니다.' });
  } catch (error) {
    console.error('Chat session error:', error?.message || error);
    return json(res, 500, { error: '상담 세션 처리 중 문제가 발생했습니다.' });
  }
}
