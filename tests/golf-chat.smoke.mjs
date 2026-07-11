import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../api/golf-chat.js', import.meta.url);
const source = fs.readFileSync(apiPath, 'utf8').replace('export default async function handler', 'async function handler');

let fetchMode = 'ok';
let calls = [];
const fetchMock = async (url, options) => {
  calls.push({ url, options });
  if (fetchMode === 'error') return { ok: false, text: async () => 'secret upstream body' };
  return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ok' }] }] }) };
};

const factory = new Function('process', 'fetch', 'Buffer', `${source}\nreturn handler;`);
const handler = factory({ env: { GEMINI_API_KEY: 'test-key' } }, fetchMock, Buffer);

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

let res = response();
await handler({ method: 'GET', headers: {} }, res);
assert.equal(res.statusCode, 405);

res = response();
await handler({ method: 'POST', body: { messages: [] }, headers: {}, socket: {} }, res);
assert.equal(res.statusCode, 400);

res = response();
await handler({ method: 'POST', body: { messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })) }, headers: {}, socket: {} }, res);
assert.equal(res.statusCode, 400);

calls = [];
res = response();
await handler({ method: 'POST', body: { messages: [{ role: 'user', content: '안녕하세요' }] }, headers: { 'x-forwarded-for': '1.1.1.1' }, socket: {} }, res);
assert.equal(res.statusCode, 200);
assert.equal(calls[0].url.includes('?key='), false);
assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key');
assert.equal(calls[0].options.body.includes('max_output_tokens'), true);

fetchMode = 'error';
res = response();
await handler({ method: 'POST', body: { messages: [{ role: 'user', content: '오류 테스트' }] }, headers: { 'x-forwarded-for': '2.2.2.2' }, socket: {} }, res);
assert.equal(res.statusCode, 502);
assert.equal('detail' in res.body, false);

fetchMode = 'ok';
for (let i = 0; i < 20; i += 1) {
  res = response();
  await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'rate' }] }, headers: { 'x-forwarded-for': '3.3.3.3' }, socket: {} }, res);
  assert.equal(res.statusCode, 200);
}
res = response();
await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'rate' }] }, headers: { 'x-forwarded-for': '3.3.3.3' }, socket: {} }, res);
assert.equal(res.statusCode, 429);

console.log('JP Golf API smoke tests passed');
