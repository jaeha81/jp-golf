import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const TEST_AMOUNT_KRW = 10000;
const json = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body));

function database() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS payment_orders (
    id BIGSERIAL PRIMARY KEY, order_id UUID NOT NULL UNIQUE,
    request_id BIGINT NOT NULL REFERENCES customer_requests(id), provider TEXT NOT NULL,
    mode TEXT NOT NULL, amount_krw INTEGER NOT NULL CHECK (amount_krw >= 0),
    status TEXT NOT NULL, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS payment_key TEXT`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: '허용하지 않는 메서드입니다.' });
  }
  const clientKey = process.env.TOSS_TEST_CLIENT_KEY?.trim();
  const secretKey = process.env.TOSS_TEST_SECRET_KEY?.trim();
  if (!clientKey?.startsWith('test_') || !secretKey?.startsWith('test_')) {
    return json(res, 503, { error: '토스 테스트 키가 아직 등록되지 않았습니다.' });
  }
  const sql = database();
  if (!sql) return json(res, 503, { error: '결제 저장소가 연결되지 않았습니다.' });

  try {
    await ensureTables(sql);
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const requestId = Number(body?.requestId);
    if (!Number.isInteger(requestId) || requestId < 1) return json(res, 400, { error: '상담 접수번호가 올바르지 않습니다.' });
    const request = await sql`SELECT id, name, contact FROM customer_requests WHERE id=${requestId}`;
    if (!request.length) return json(res, 404, { error: '상담 접수를 찾을 수 없습니다.' });

    const orderId = randomUUID();
    await sql`INSERT INTO payment_orders (order_id, request_id, provider, mode, amount_krw, status)
      VALUES (${orderId}, ${requestId}, 'toss_payments', 'toss_test', ${TEST_AMOUNT_KRW}, 'ready')`;
    return json(res, 201, {
      payment: { orderId, amount: TEST_AMOUNT_KRW, orderName: 'JP Golf 예약 상담 테스트', customerName: request[0].name, customerEmail: request[0].contact.includes('@') ? request[0].contact : undefined },
      clientKey
    });
  } catch (error) {
    console.error('Toss test order error:', error?.message || error);
    return json(res, 500, { error: '토스 테스트 주문 생성 중 문제가 발생했습니다.' });
  }
}
