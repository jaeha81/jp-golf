import { neon } from '@neondatabase/serverless';
import { randomUUID, timingSafeEqual } from 'node:crypto';

const TEST_AMOUNT_KRW = 10000;
const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body));
};

function database() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function adminAuthorized(req) {
  const configured = process.env.ADMIN_QUEUE_TOKEN?.trim();
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    || req.headers['x-admin-token']?.trim();
  if (!configured || !supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS payment_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE,
    request_id BIGINT NOT NULL REFERENCES customer_requests(id),
    provider TEXT NOT NULL,
    mode TEXT NOT NULL,
    amount_krw INTEGER NOT NULL CHECK (amount_krw >= 0),
    status TEXT NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS payment_orders_request_created_idx ON payment_orders (request_id, created_at DESC)`;
}

export default async function handler(req, res) {
  const sql = database();
  if (!sql) return json(res, 503, { error: '결제 저장소가 연결되지 않았습니다.' });

  try {
    await ensureTables(sql);

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const requestId = Number(body?.requestId);
      if (!Number.isInteger(requestId) || requestId < 1) return json(res, 400, { error: '상담 접수번호가 올바르지 않습니다.' });

      const request = await sql`SELECT id FROM customer_requests WHERE id=${requestId}`;
      if (!request.length) return json(res, 404, { error: '상담 접수를 찾을 수 없습니다.' });

      const orderId = randomUUID();
      const result = await sql`INSERT INTO payment_orders (order_id, request_id, provider, mode, amount_krw, status)
        VALUES (${orderId}, ${requestId}, 'toss_payments', 'test', ${TEST_AMOUNT_KRW}, 'ready')
        RETURNING order_id, request_id, amount_krw, status, created_at`;
      return json(res, 201, {
        payment: result[0],
        notice: '테스트 결제입니다. 실제 청구는 발생하지 않습니다.'
      });
    }

    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json(res, 400, { error: '테스트 주문번호가 올바르지 않습니다.' });

      const result = await sql`UPDATE payment_orders
        SET status='paid', paid_at=NOW(), updated_at=NOW()
        WHERE order_id=${orderId}::uuid AND mode='test' AND status='ready'
        RETURNING order_id, request_id, amount_krw, status, paid_at`;
      if (!result.length) return json(res, 409, { error: '이미 처리되었거나 존재하지 않는 테스트 주문입니다.' });
      return json(res, 200, {
        payment: result[0],
        notice: '테스트 결제가 완료되었습니다. 실제 청구는 발생하지 않았습니다.'
      });
    }

    if (req.method === 'GET') {
      if (!adminAuthorized(req)) return json(res, 401, { error: '관리자 비밀번호가 올바르지 않습니다.' });
      const rows = await sql`SELECT order_id, request_id, provider, mode, amount_krw, status, paid_at, created_at
        FROM payment_orders ORDER BY created_at DESC LIMIT 200`;
      return json(res, 200, { payments: rows });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return json(res, 405, { error: '허용하지 않는 메서드입니다.' });
  } catch (error) {
    console.error('Test payment error:', error?.message || error);
    return json(res, 500, { error: '테스트 결제 처리 중 문제가 발생했습니다.' });
  }
}
