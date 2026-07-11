import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../api/golf-chat.js', import.meta.url);
const source = fs.readFileSync(apiPath, 'utf8')
  .replace('export default async function handler', 'async function handler');

let fetchMode = 'ok';
let calls = [];
const fetchMock = async (url, options) => {
  calls.push({ url, options });
  if (fetchMode === 'throw') throw new Error('network failure');
  if (fetchMode === 'error') {
    return { ok: false, status: 400, text: async () => 'private upstream error' };
  }
  if (fetchMode === 'bad-json') {
    return { ok: true, json: async () => { throw new Error('invalid json'); } };
  }
  if (fetchMode === 'empty') {
    return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [] }] }) };
  }
  return {
    ok: true,
    json: async () => ({
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: 'old' }] },
        { type: 'thought', content: [{ type: 'text', text: 'hidden' }] },
        {
          type: 'model_output',
          content: [
            { type: 'text', text: '정상 ' },
            { type: 'image', uri: 'ignored' },
            { type: 'text', text: '응답' },
          ],
        },
      ],
    }),
  };
};

const factory = new Function('process', 'fetch', 'Buffer', `${source}\nreturn handler;`);
const handler = factory(
  { env: { GEMINI_API_KEY: '  AQ.test-key  ' } },
  fetchMock,
  Buffer,
);

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
await handler({
  method: 'POST',
  body: { messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })) },
  headers: {},
  socket: {},
}, res);
assert.equal(res.statusCode, 400);

calls = [];
res = response();
await handler({
  method: 'POST',
  body: {
    messages: [
      { role: 'user', content: '도쿄 골프장을 추천해줘' },
      { role: 'assistant', content: '날짜와 인원을 알려주세요.' },
    ],
  },
  headers: { 'x-forwarded-for': '1.1.1.1' },
  socket: {},
}, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.content, '정상 응답');
assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1/interactions');
assert.equal(calls[0].options.headers['x-goog-api-key'], 'AQ.test-key');

const upstreamBody = JSON.parse(calls[0].options.body);
assert.equal(upstreamBody.model, 'models/gemini-3.5-flash');
assert.equal(typeof upstreamBody.system_instruction, 'string');
assert.equal(upstreamBody.store, false);
assert.deepEqual(upstreamBody.generation_config, { max_output_tokens: 512 });
assert.deepEqual(upstreamBody.input, [
  { type: 'user_input', content: [{ type: 'text', text: '도쿄 골프장을 추천해줘' }] },
  { type: 'model_output', content: [{ type: 'text', text: '날짜와 인원을 알려주세요.' }] },
]);

fetchMode = 'error';
res = response();
await handler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: '오류 테스트' }] },
  headers: { 'x-forwarded-for': '2.2.2.2' },
  socket: {},
}, res);
assert.equal(res.statusCode, 502);
assert.equal('detail' in res.body, false);

fetchMode = 'empty';
res = response();
await handler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: '빈 응답 테스트' }] },
  headers: { 'x-forwarded-for': '2.2.2.3' },
  socket: {},
}, res);
assert.equal(res.statusCode, 502);

fetchMode = 'throw';
res = response();
await handler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: '네트워크 예외 테스트' }] },
  headers: { 'x-forwarded-for': '2.2.2.4' },
  socket: {},
}, res);
assert.equal(res.statusCode, 502);

fetchMode = 'bad-json';
res = response();
await handler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: '비JSON 응답 테스트' }] },
  headers: { 'x-forwarded-for': '2.2.2.5' },
  socket: {},
}, res);
assert.equal(res.statusCode, 502);

fetchMode = 'ok';
for (let i = 0; i < 20; i += 1) {
  res = response();
  await handler({
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', content: 'rate' }] }),
    headers: { 'x-forwarded-for': '3.3.3.3' },
    socket: {},
  }, res);
  assert.equal(res.statusCode, 200);
}
res = response();
await handler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: 'rate' }] },
  headers: { 'x-forwarded-for': '3.3.3.3' },
  socket: {},
}, res);
assert.equal(res.statusCode, 429);

calls = [];
const fallbackHandler = factory(
  { env: { GOOGLE_API_KEY: ' AQ.fallback-key ' } },
  fetchMock,
  Buffer,
);
res = response();
await fallbackHandler({
  method: 'POST',
  body: { messages: [{ role: 'user', content: '대체 키 테스트' }] },
  headers: { 'x-forwarded-for': '4.4.4.4' },
  socket: {},
}, res);
assert.equal(res.statusCode, 200);
assert.equal(calls[0].options.headers['x-goog-api-key'], 'AQ.fallback-key');

console.log('JP Golf API smoke tests passed');
