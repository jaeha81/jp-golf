const SYSTEM_PROMPT = `당신은 일본 골프 예약을 돕는 한국어 상담 AI입니다.

현재 서비스는 베타 단계이며, 표시하는 골프장·가격·티타임은 예시 정보입니다. 실시간 재고나 예약 확정으로 오해하게 말하지 마세요. 실제 예약은 제휴사 공식 예약 페이지에서 사용자가 직접 완료해야 합니다.

대화 규칙:
- 지역, 날짜, 인원, 예산을 먼저 확인하고 모르는 정보는 추측하지 마세요.
- 추천 코스를 보여줄 때는 [[SHOW_COURSES]] 토큰을 한 번만 포함하세요.
- 사용자가 특정 코스 예약 흐름을 원하면 [[SHOW_BOOKING:번호]] 토큰을 포함하세요.
- 답변은 자연스러운 한국어로 짧고 명확하게 작성하세요.
- 결제, 예약 확정, 실시간 가격·재고를 보장하지 마세요.`;

const CONSULTATION_FLOW = `
상담 진행 규칙: 먼저 지역, 총 인원, 여행 날짜와 숙박 박수를 차례로 확인한다. 다음 라운딩 횟수·희망 라운딩 날짜·1인 예산·티오프 시간대를 확인한다. 비행기 발권 여부를 묻고, 미발권이면 출발 공항과 항공편 시간에 따라 첫날·마지막날 라운딩 가능 여부를 나눠 안내한다. 발권했으면 항공편명과 도착·출발 시각을 받아 라운딩 날짜를 맞춘다. 골프장 선호(명문·가성비·리조트·바다 전망·온천), 셀프/캐디, 카트·식사·2인 추가요금 여부도 확인한다. 충분히 모이면 날짜·지역·인원·라운딩 날짜·횟수·예산·항공권 상태를 요약해 고객 확인을 받고, 고객이 알아봐 달라고 하면 [[SHOW_COURSES]]를 붙인다. 질문은 한 번에 하나씩 짧게 하고 예약·가격·재고는 공식 페이지 확인 전 보장하지 않는다.
`;

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

function textForConditionMatching(messages) {
  return messages
    .filter(message => message.role === 'user')
    .map(message => message.content)
    .join(' ')
    .normalize('NFKC')
    .replace(/[·•,，、]/g, ' ')
    .replace(/[～〜]/g, '~')
    .replace(/[／]/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackReply(messages) {
  const text = textForConditionMatching(messages);
  const region = text.match(/도쿄|지바|나리타|오사카|교토|후쿠오카|하코네|후지|오키나와|홋카이도|규슈/i);
  const players = text.match(/([1-7])\s*(?:명|인)|8\s*(?:명|인)\s*이상/);
  const date = text.match(/20\d{2}\s*(?:[-./]|년)\s*\d{1,2}\s*(?:[-./]|월)\s*\d{1,2}\s*(?:일)?/);
  const budget = text.match(/(?:예산|\d[\d,\s]*(?:만\s*원|천\s*엔|원|엔)|[¥￥]\s*\d[\d,\s]*|JPY\s*\d[\d,\s]*)/i);

  if (!region) return '원하시는 일본 골프 지역을 먼저 알려주세요. 예: 도쿄 근교, 오사카, 오키나와';
  if (!players) return '함께 라운드하실 인원을 알려주세요. 아래 플레이 인원 입력란을 사용하셔도 됩니다.';
  if (!date) return '희망 라운딩 날짜를 알려주세요. 아래 날짜 입력란에서 선택하셔도 됩니다.';
  if (!budget) return '1인당 선호 예산을 알려주세요. 아래 예산 입력란에 입력하시면 바로 반영됩니다.';
  return '조건을 확인했습니다. 아래 상담 의뢰에 연락처와 원하는 조건을 남겨주시면 상담사가 이어서 도와드리겠습니다.';
}

function hasConsultationCondition(messages) {
  const text = textForConditionMatching(messages);
  return /도쿄|지바|나리타|오사카|교토|후쿠오카|하코네|후지|오키나와|홋카이도|규슈|([1-7])\s*(?:명|인)|8\s*(?:명|인)\s*이상|20\d{2}\s*(?:[-./]|년)\s*\d{1,2}\s*(?:[-./]|월)\s*\d{1,2}\s*(?:일)?|예산|\d[\d,\s]*(?:만\s*원|천\s*엔|원|엔)|[¥￥]\s*\d[\d,\s]*|JPY\s*\d[\d,\s]*/i.test(text);
}

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

  const fastReply = fallbackReply(normalizedMessages);
  if (hasConsultationCondition(normalizedMessages)) {
    res.status(200).json({ content: fastReply, source: 'fast-path' });
    return;
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
  let geminiRes;
  try {
    geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1/interactions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          model: FREE_MODEL.startsWith('models/') ? FREE_MODEL : `models/${FREE_MODEL}`,
          system_instruction: `${SYSTEM_PROMPT}\n${CONSULTATION_FLOW}`,
          input,
          store: false,
          generation_config: {
            max_output_tokens: MAX_OUTPUT_TOKENS,
            thinking_level: 'minimal',
            thinking_summaries: 'none',
          },
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    res.status(200).json({ content: fallbackReply(normalizedMessages), source: 'fallback' });
    return;
  }

  if (!geminiRes.ok) {
    res.status(200).json({ content: fallbackReply(normalizedMessages), source: 'fallback' });
    return;
  }
  let data;
  try {
    data = await geminiRes.json();
  } catch {
    res.status(200).json({ content: fallbackReply(normalizedMessages), source: 'fallback' });
    return;
  }
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const modelOutput = steps.filter(step => step?.type === 'model_output').at(-1);
  const content = Array.isArray(modelOutput?.content)
    ? modelOutput.content
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('')
      .trim()
    : '';
  if (!content) {
    res.status(200).json({ content: fallbackReply(normalizedMessages), source: 'fallback' });
    return;
  }
  res.status(200).json({ content });
}
