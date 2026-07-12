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

export default async function handler(req, res) {
  if (req.method !== 'POST' && !adminAuthorized(req)) return json(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' });
  const sql = database();
  if (!sql) return json(res, 503, { error: '비밀번호는 확인됐지만 관리자 의뢰 저장소가 아직 연결되지 않았습니다.' });

  try {
    await sql`CREATE TABLE IF NOT EXISTS customer_requests (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      golf_date DATE,
      players INTEGER,
      budget_per_person INTEGER,
      request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS customer_requests_status_created_idx ON customer_requests (status, created_at)`;

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const name = clean(body?.name, 80);
      const contact = clean(body?.contact, 120);
      const request = clean(body?.request);
      const players = Number(body?.players);
      const budget = Number(body?.budgetPerPerson);
      if (!name || !contact || !request) return json(res, 400, { error: '이름, 연락처, 의뢰 내용을 입력해 주세요.' });
      if (body?.golfDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.golfDate)) return json(res, 400, { error: '날짜 형식이 올바르지 않습니다.' });
      if (body?.players && (!Number.isInteger(players) || players < 1 || players > 20)) return json(res, 400, { error: '인원 수가 올바르지 않습니다.' });
      const result = await sql`INSERT INTO customer_requests (name, contact, golf_date, players, budget_per_person, request)
        VALUES (${name}, ${contact}, ${body.golfDate || null}, ${body.players ? players : null}, ${body.budgetPerPerson ? budget : null}, ${request})
        RETURNING id, status, created_at`;
      return json(res, 201, { request: result[0] });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, contact, golf_date, players, budget_per_person, request, status, created_at, updated_at
        FROM customer_requests ORDER BY id ASC LIMIT 200`;
      return json(res, 200, { requests: rows });
    }
    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const id = Number(body?.id);
      const status = clean(body?.status, 20);
      if (!Number.isInteger(id) || !['new', 'contacted', 'quoted', 'closed'].includes(status)) return json(res, 400, { error: '요청 상태가 올바르지 않습니다.' });
      const result = await sql`UPDATE customer_requests SET status=${status}, updated_at=NOW() WHERE id=${id} RETURNING id, status, updated_at`;
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
