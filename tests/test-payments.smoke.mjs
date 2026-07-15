import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../api/test-payments.js', import.meta.url);
const source = fs.readFileSync(apiPath, 'utf8')
  .replace("import { neon } from '@neondatabase/serverless';", '')
  .replace("import { randomUUID, timingSafeEqual } from 'node:crypto';", '')
  .replace('export default async function handler', 'async function handler');

let customerExists = true;
let updateSucceeds = true;
const sql = async (strings, ...values) => {
  const query = strings.join('?');
  if (query.includes('SELECT id FROM customer_requests')) return customerExists ? [{ id: values[0] }] : [];
  if (query.includes('INSERT INTO payment_orders')) return [{ order_id: values[0], request_id: values[1], amount_krw: 10000, status: 'ready' }];
  if (query.includes("UPDATE payment_orders")) return updateSucceeds ? [{ order_id: values[0], request_id: 1, amount_krw: 10000, status: 'paid' }] : [];
  if (query.includes('FROM payment_orders')) return [{ order_id: '00000000-0000-4000-8000-000000000001', request_id: 1, amount_krw: 10000, status: 'paid' }];
  return [];
};

const factory = new Function('process', 'neon', 'randomUUID', 'timingSafeEqual', 'Buffer', `${source}\nreturn handler;`);
const handler = factory(
  { env: { DATABASE_URL: 'postgres://test', ADMIN_QUEUE_TOKEN: 'admin-token' } },
  () => sql,
  () => '00000000-0000-4000-8000-000000000001',
  (a, b) => Buffer.compare(a, b) === 0,
  Buffer,
);

function response() {
  return {
    statusCode: 200, body: undefined, headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    end(body) { this.body = JSON.parse(body); return this; },
  };
}

let res = response();
await handler({ method: 'POST', body: {}, headers: {} }, res);
assert.equal(res.statusCode, 400);

customerExists = false;
res = response();
await handler({ method: 'POST', body: { requestId: 1 }, headers: {} }, res);
assert.equal(res.statusCode, 404);

customerExists = true;
res = response();
await handler({ method: 'POST', body: { requestId: 1 }, headers: {} }, res);
assert.equal(res.statusCode, 201);
assert.equal(res.body.payment.status, 'ready');
assert.equal(res.body.payment.amount_krw, 10000);

res = response();
await handler({ method: 'PATCH', body: { orderId: '00000000-0000-4000-8000-000000000001' }, headers: {} }, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.payment.status, 'paid');

updateSucceeds = false;
res = response();
await handler({ method: 'PATCH', body: { orderId: '00000000-0000-4000-8000-000000000001' }, headers: {} }, res);
assert.equal(res.statusCode, 409);

res = response();
await handler({ method: 'GET', headers: {} }, res);
assert.equal(res.statusCode, 401);

res = response();
await handler({ method: 'GET', headers: { authorization: 'Bearer admin-token' } }, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.payments.length, 1);

console.log('JP Golf test payment smoke tests passed');
