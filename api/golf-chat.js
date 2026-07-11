const SYSTEM_PROMPT = `당신은 일본 골프 예약을 돕는 한국어 상담 AI입니다.

현재 서비스는 베타 단계이며, 표시하는 골프장·가격·티타임은 예시 정보입니다. 실시간 재고나 예약 확정으로 오해하게 말하지 마세요. 실제 예약은 제휴사 공식 예약 페이지에서 사용자가 직접 완료해야 합니다.

대화 규칙:
- 지역, 날짜, 인원, 예산을 먼저 확인하고 모르는 정보는 추측하지 마세요.
- 추천 코스를 보여줄 때는 [[SHOW_COURSES]] 토큰을 한 번만 포함하세요.
- 사용자가 특정 코스 예약 흐름을 원하면 [[SHOW_BOOKING:번호]] 토큰을 포함하세요.
- 답변은 자연스러운 한국어로 짧고 명확하게 작성하세요.
- 결제, 예약 확정, 실시간 가격·재고를 보장하지 마세요.`;

const FREE_MODEL = process.env.JP_GOLF_GEMINI_MODEL || 'gemini-3.5-flash';
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOTAL_LENGTH = 12000;
const MAX_OUTPUT_TOKENS = 512;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_MAX_KEYS = 1000;
const rateLimitStore = globalThis.__jpGolfRateLimit ?? new Map();
globalThis.__jpGolfRateLimit = rateLimitStore;

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
  let entry = rateLimitStore.get(ip);
  if (!entry) {
    if (rateLimitStore.size >= RATE_LIMIT_MAX_KEYS) return true;
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, entry);
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (isRateLimited(getClientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  let body = {};
  if (req.body && typeof req.body === 'object') body = req.body;
  else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    try { body = JSON.parse(req.body.toString()); } catch { body = {}; }
  } else {
    const raw = await new Promise(resolve => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const normalizedMessages = [];
  let totalLength = 0;
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      res.status(400).json({ error: 'invalid message format' });
      return;
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'message length is invalid' });
      return;
    }
    totalLength += content.length;
    if (totalLength > MAX_TOTAL_LENGTH) {
      res.status(400).json({ error: 'conversation is too long' });
      return;
    }
    normalizedMessages.push({ role: message.role, content });
  }

  const apiKey = (
    process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_AI_API_KEY
    || ''
  ).trim();
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  const input = normalizedMessages.map(message => ({
    type: message.role === 'assistant' ? 'model_output' : 'user_input',
    content: [{ type: 'text', text: message.content }],
  }));
  const geminiRes = await fetch(
    'https://generativelanguage.googleapis.com/v1/interactions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: FREE_MODEL.startsWith('models/') ? FREE_MODEL : `models/${FREE_MODEL}`,
        system_instruction: SYSTEM_PROMPT,
        input,
        store: false,
        generation_config: { max_output_tokens: MAX_OUTPUT_TOKENS },
      }),
    },
  );

  if (!geminiRes.ok) {
    res.status(502).json({ error: 'Upstream API error' });
    return;
  }
  const data = await geminiRes.json();
  const modelOutput = data?.steps?.filter(step => step?.type === 'model_output').at(-1);
  const content = Array.isArray(modelOutput?.content)
    ? modelOutput.content
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('')
      .trim()
    : '';
  if (!content) {
    res.status(502).json({ error: 'Empty upstream response' });
    return;
  }
  res.status(200).json({ content });
}
