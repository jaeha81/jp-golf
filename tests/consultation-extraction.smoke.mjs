import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../docs/jp-golf.html', import.meta.url), 'utf8');
const start = html.indexOf('  function isoDate(year, month, day) {');
const end = html.indexOf('  function applySelectedConditions() {');
assert.ok(start >= 0 && end > start, 'Consultation extraction functions were not found.');
const source = html.slice(start, end);
const fields = {
  golfDate: { value: '' }, golfEndDate: { value: '' }, golfPlayers: { value: '' }, golfBudget: { value: '' },
  stayLengthHint: { textContent: '' },
};
const document = { getElementById: id => fields[id] };
const chatMessages = [{ role: 'user', content: '후쿠오카에서 2026년 9월 10일부터 9월 13일까지 4명, 1인당 20만원으로 갈게요.' }];
const evaluator = new Function('document', 'chatMessages', 'fetch', 'chatSessionId', `const golfDate=document.getElementById('golfDate'),golfEndDate=document.getElementById('golfEndDate'),golfPlayers=document.getElementById('golfPlayers'),golfBudget=document.getElementById('golfBudget'); let consultationRegion = ''; const updateStayLength = () => {};${source}\nreturn { extractConsultationConditions, consultationSummary };`);
const { extractConsultationConditions, consultationSummary } = evaluator(document, chatMessages, () => Promise.resolve(), '00000000-0000-4000-8000-000000000001');

extractConsultationConditions(chatMessages[0].content);
assert.equal(fields.golfDate.value, '2026-09-10');
assert.equal(fields.golfEndDate.value, '2026-09-13');
assert.equal(fields.golfPlayers.value, '4');
assert.equal(fields.golfBudget.value, 200000);
assert.match(consultationSummary(), /희망 지역: 후쿠오카/);
assert.match(consultationSummary(), /플레이 인원: 4명/);
assert.match(consultationSummary(), /1인당 선호 예산: 200,000원/);

console.log('JP Golf consultation extraction smoke tests passed');
