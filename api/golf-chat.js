const SYSTEM_PROMPT = `당신은 일본 골프 예약을 도와주는 친근한 AI 어시스턴트입니다. 한국어로 답변합니다.

이용 가능한 골프장 목록 (인덱스 0~2):
0: 치바 그린 컨트리클럽 (千葉グリーンCC) — 도쿄 근교, ¥18,500, 티타임 7:42/7:50/8:06
1: 하코네 긴란 골프클럽 (箱根銀蘭GC) — 하코네, ¥28,500, 티타임 8:20/9:00
2: 나리타 노스 컨트리클럽 (成田ノースCC) — 나리타 인근, ¥16,800, 티타임 7:30/8:10

대화 규칙:
- 지역, 날짜, 인원, 예산 등 예약에 필요한 정보를 자연스럽게 파악하세요
- 코스를 보여줘야 할 때는 응답 끝에 [[SHOW_COURSES]] 를 추가하세요
- 특정 골프장 예약으로 진행할 때는 [[SHOW_BOOKING:n]] (n=인덱스)을 추가하세요
- 두 마커를 동시에 쓰지 마세요
- 마커 외 응답은 자연스러운 한국어 대화체로 작성하세요
- 예산이 맞지 않거나 원하는 지역이 없으면 솔직하게 알려주세요`;

const FREE_MODEL = process.env.JP_GOLF_GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
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
  if (req.body && typeof req.body === 'object') {
    body = req.body;
  } else {
    const raw = await new Promise((resolve) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  // MVP 무료 검증 단계: 전 모드 Gemini 2.5 Flash-Lite 무료 티어 사용.
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
  // 결제 연동(가이드모드) 완료 후 Claude Haiku 4.5 유료 전환 예정 — ObsidianVault/03_Projects/jp-golf/2026-07-04-ai-api-stack.md 참조.
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${FREE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        contents: normalizedMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    }
  );

  if (!geminiRes.ok) {
    res.status(502).json({ error: 'Upstream API error' });
    return;
  }

  const data = await geminiRes.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '죄송해요, 잠시 오류가 발생했어요.';

  res.status(200).json({ content });
}
