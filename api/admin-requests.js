import { neon } from '@neondatabase/serverless';
import { timingSafeEqual } from 'node:crypto';

const MAX_TEXT = 2000;
const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body));
};

function sameSecret(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminAuthorized(req) {
  const configured = process.env.ADMIN_QUEUE_TOKEN?.trim();
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    || req.headers['x-admin-token']?.trim();
  return sameSecret(supplied, configured);
}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function clean(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

let schemaReady;
async function ensureRequestSchema(sql) {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS customer_requests (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, golf_date DATE, stay_end_date DATE,
      stay_nights INTEGER, players INTEGER, budget_per_person INTEGER, request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS stay_nights INTEGER`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS stay_end_date DATE`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS quote_course_name TEXT`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS quote_date DATE`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS quote_tee_time TEXT`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS quote_price_per_person INTEGER`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS quote_google_maps_url TEXT`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS hook_status TEXT NOT NULL DEFAULT 'not_configured'`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS hook_attempted_at TIMESTAMPTZ`;
    await sql`ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS chat_session_id UUID`;
    await sql`CREATE INDEX IF NOT EXISTS customer_requests_status_created_idx ON customer_requests (status, created_at)`;
    await sql`CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id UUID PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', region TEXT, golf_date DATE, stay_end_date DATE,
      players INTEGER, budget_per_person INTEGER, request_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  })().catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}

async function notifyAdminWebhook(request) {
  const rawUrl = process.env.ADMIN_REQUEST_WEBHOOK_URL?.trim();
  if (!rawUrl) return 'not_configured';
  let url;
  try {
    url = new URL(rawUrl);
    if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
  } catch (error) {
    console.error('Admin request webhook URL is invalid:', error?.message || error);
    return 'failed';
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-JP-Golf-Event': 'consultation.received' },
      body: JSON.stringify({ event: 'consultation.received', occurredAt: new Date().toISOString(), request }),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return 'delivered';
  } catch (error) {
    console.error('Admin request webhook failed:', error?.message || error);
    return 'failed';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && !adminAuthorized(req)) return json(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' });
  const sql = database();
  if (!sql) return json(res, 503, { error: '비밀번호는 확인됐지만 관리자 의뢰 저장소가 아직 연결되지 않았습니다.' });

  try {
    await ensureRequestSchema(sql);

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const name = clean(body?.name, 80);
      const contact = clean(body?.contact, 120);
      const request = clean(body?.request);
      const players = Number(body?.players);
      const stayNights = Number(body?.stayNights);
      const budget = Number(body?.budgetPerPerson);
      if (!name || !contact || !request) return json(res, 400, { error: '이름, 연락처, 의뢰 내용을 입력해 주세요.' });
      if (body?.golfDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.golfDate)) return json(res, 400, { error: '날짜 형식이 올바르지 않습니다.' });
      if (body?.stayEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.stayEndDate)) return json(res, 400, { error: '귀국 날짜 형식이 올바르지 않습니다.' });
      if (body?.golfDate && body?.stayEndDate && body.stayEndDate < body.golfDate) return json(res, 400, { error: '귀국 날짜는 출발 날짜 이후여야 합니다.' });
      if (body?.stayNights !== '' && body?.stayNights != null && (!Number.isInteger(stayNights) || stayNights < 0 || stayNights > 30)) return json(res, 400, { error: '숙박 기간이 올바르지 않습니다.' });
      if (body?.players && (!Number.isInteger(players) || players < 1 || players > 20)) return json(res, 400, { error: '인원 수가 올바르지 않습니다.' });
      const chatSessionId = typeof body?.chatSessionId === 'string' && /^[0-9a-f-]{36}$/i.test(body.chatSessionId) ? body.chatSessionId : null;
      const result = await sql`INSERT INTO customer_requests (name, contact, golf_date, stay_end_date, stay_nights, players, budget_per_person, request, chat_session_id)
        VALUES (${name}, ${contact}, ${body.golfDate || null}, ${body.stayEndDate || null}, ${body?.stayNights !== '' && body?.stayNights != null ? stayNights : null}, ${body.players ? players : null}, ${body.budgetPerPerson ? budget : null}, ${request}, ${chatSessionId}::uuid)
        RETURNING id, name, contact, golf_date, stay_end_date, stay_nights, players, budget_per_person, request, status, created_at`;
      const hookStatus = await notifyAdminWebhook(result[0]);
      const updated = await sql`UPDATE customer_requests SET hook_status=${hookStatus}, hook_attempted_at=NOW(), updated_at=NOW() WHERE id=${result[0].id}
        RETURNING id, status, hook_status, hook_attempted_at, created_at`;
      if (chatSessionId) await sql`UPDATE chat_sessions SET request_id=${result[0].id}, status='submitted', updated_at=NOW() WHERE session_id=${chatSessionId}::uuid`;
      return json(res, 201, { request: updated[0] });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, contact, golf_date, stay_end_date, stay_nights, players, budget_per_person, request, status, quote_course_name, quote_date, quote_tee_time, quote_price_per_person, quote_google_maps_url, hook_status, hook_attempted_at, chat_session_id, created_at, updated_at
        FROM customer_requests ORDER BY id ASC LIMIT 200`;
      return json(res, 200, { requests: rows });
    }
    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const id = Number(body?.id);
      const status = clean(body?.status, 20);
      const quoteCourseName = clean(body?.quoteCourseName, 160);
      const quoteDate = clean(body?.quoteDate, 10);
      const quoteTeeTime = clean(body?.quoteTeeTime, 20);
      const quotePricePerPerson = Number(body?.quotePricePerPerson);
      const quoteGoogleMapsUrl = clean(body?.quoteGoogleMapsUrl, 1000);
      if (!Number.isInteger(id) || !['new', 'contacted', 'quoted', 'closed'].includes(status)) return json(res, 400, { error: '요청 상태가 올바르지 않습니다.' });
      if (quoteDate && !/^\d{4}-\d{2}-\d{2}$/.test(quoteDate)) return json(res, 400, { error: '검수 날짜 형식이 올바르지 않습니다.' });
      if (quoteTeeTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(quoteTeeTime)) return json(res, 400, { error: '티타임은 HH:MM 형식으로 입력해 주세요.' });
      if (quoteGoogleMapsUrl && !/^https:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl\/)/i.test(quoteGoogleMapsUrl)) return json(res, 400, { error: '구글맵 공유 주소를 입력해 주세요.' });
      const hasQuote = quoteCourseName && quoteDate && quoteTeeTime && Number.isInteger(quotePricePerPerson) && quotePricePerPerson > 0 && quoteGoogleMapsUrl;
      if (status === 'quoted' && !hasQuote) return json(res, 400, { error: '견적안내 전 골프장, 날짜, 티타임, 1인 가격, 구글맵 주소를 모두 입력해 주세요.' });
      const result = await sql`UPDATE customer_requests SET status=${status}, quote_course_name=${quoteCourseName || null}, quote_date=${quoteDate || null}, quote_tee_time=${quoteTeeTime || null}, quote_price_per_person=${Number.isInteger(quotePricePerPerson) && quotePricePerPerson > 0 ? quotePricePerPerson : null}, quote_google_maps_url=${quoteGoogleMapsUrl || null}, updated_at=NOW() WHERE id=${id} RETURNING id, status, quote_course_name, quote_date, quote_tee_time, quote_price_per_person, quote_google_maps_url, updated_at`;
      if (!result.length) return json(res, 404, { error: '의뢰를 찾을 수 없습니다.' });
      return json(res, 200, { request: result[0] });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return json(res, 405, { error: '허용되지 않은 메서드입니다.' });
  } catch (error) {
    console.error('Admin request queue error:', error?.message || error);
    return json(res, 500, { error: '의뢰 처리 중 문제가 발생했습니다.' });
  }
}
