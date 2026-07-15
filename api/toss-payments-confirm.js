import { neon } from '@neondatabase/serverless';

const json = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body));
const database = () => process.env.DATABASE_URL?.trim() ? neon(process.env.DATABASE_URL.trim()) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: '허용하지 않는 메서드입니다.' });
  }
  const secretKey = process.env.TOSS_TEST_SECRET_KEY?.trim();
  const sql = database();
  if (!secretKey?.startsWith('test_')) return json(res, 503, { error: '토스 테스트 키가 아직 등록되지 않았습니다.' });
  if (!sql) return json(res, 503, { error: '결제 저장소가 연결되지 않았습니다.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const paymentKey = typeof body?.paymentKey === 'string' ? body.paymentKey : '';
    const amount = Number(body?.amount);
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !paymentKey || !Number.isInteger(amount)) return json(res, 400, { error: '결제 승인 정보가 올바르지 않습니다.' });
    const orders = await sql`SELECT order_id, amount_krw, status FROM payment_orders WHERE order_id=${orderId}::uuid AND mode='toss_test'`;
    if (!orders.length || orders[0].status !== 'ready') return json(res, 409, { error: '이미 처리되었거나 존재하지 않는 주문입니다.' });
    if (orders[0].amount_krw !== amount) return json(res, 400, { error: '결제 금액이 주문 금액과 일치하지 않습니다.' });

    const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    const tossData = await tossResponse.json();
    if (!tossResponse.ok) return json(res, 502, { error: tossData?.message || '토스 결제 승인이 실패했습니다.' });
    if (tossData.orderId !== orderId || tossData.totalAmount !== amount || tossData.status !== 'DONE') return json(res, 502, { error: '토스 결제 승인 결과를 검증하지 못했습니다.' });

    const updated = await sql`UPDATE payment_orders SET status='paid', payment_key=${paymentKey}, paid_at=NOW(), updated_at=NOW()
      WHERE order_id=${orderId}::uuid AND status='ready' RETURNING order_id, amount_krw, status, paid_at`;
    if (!updated.length) return json(res, 409, { error: '결제 승인 처리 중 주문 상태가 변경되었습니다.' });
    return json(res, 200, { payment: updated[0] });
  } catch (error) {
    console.error('Toss test confirmation error:', error?.message || error);
    return json(res, 500, { error: '토스 결제 승인 처리 중 문제가 발생했습니다.' });
  }
}
