import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../api/chat-sessions.js', import.meta.url);
const source = fs.readFileSync(apiPath, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default async function handler', 'async function handler');
let messageInserts = 0;
const sql = async (strings) => {
  const query = strings.join('?');
  if (query.includes('INSERT INTO chat_messages')) return [{ id: ++messageInserts }];
  return [];
};
const factory = new Function('process', 'neon', 'timingSafeEqual', 'Buffer', 'URL', `${source}\nreturn handler;`);
const handler = factory({ env: { DATABASE_URL: 'postgres://test' } }, () => sql, () => true, Buffer, URL);
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, end(body) { this.body = JSON.parse(body); return this; } });

const res = response();
await handler({ method: 'POST', headers: {}, body: { sessionId: '11111111-1111-4111-8111-111111111111', messages: [{ role: 'user', content: '후쿠오카 4명' }, { role: 'ai', content: '일정을 확인하겠습니다.' }] } }, res);
assert.equal(res.statusCode, 201);
assert.equal(res.body.messages.length, 2);
assert.equal(messageInserts, 2);

console.log('JP Golf chat session batch smoke tests passed');
