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

const JAPAN_ADMINISTRATIVE_CONTEXT = `
지역 해석 규칙: 고객은 일본 47개 도도부현, 시·군·구·정·촌, 공항명 또는 골프장 인근 소도시를 한국어·일본어·영문으로 물어볼 수 있다. 표기가 낯선 소도시라도 "서비스 지역이 아니다"라고 단정하지 말고, 해당 시·군·구가 속한 도도부현과 인근 공항·대표 도시를 확인하는 짧은 질문으로 이어간다. 지역을 이해했다면 먼저 인원과 여행 날짜를 확인한다.
`;

const GOLF_EXPERT_CONTEXT = `
전문 골프 상담 규칙: 고객은 싱글 핸디캡부터 경쟁 골퍼까지를 포함한다. 핸디캡·코스 레이팅·슬로프 레이팅·티 박스·야디지·파·그린 스피드(Stimpmeter)·잔디 종류·벙커·워터 해저드·고저차·도그레그·바람·난이도·전략을 전문 용어로 정확하고 간결하게 설명한다. 일본 골프의 셀프 플레이/캐디, 카트 방식, 점심 휴식 유무, 스루 플레이, 2인 추가요금, 복장·에티켓·로컬 룰도 구분해 안내한다. 특정 코스의 수치나 당일 컨디션은 공식 코스 가이드·예약 페이지 확인이 필요한 정보임을 밝히고 추측으로 단정하지 않는다. 특정 코스가 정해지지 않은 도도부현·지역 단위 질문에는 그린 스피드·잔디 종류·코스 레이팅·슬로프 레이팅·야디지의 숫자 범위나 코스명을 만들어 답하지 말고, 해당 값은 코스·티·시즌별로 달라진다고 명확히 말한 뒤 원하는 코스명을 먼저 확인한다. 전문 질문에는 일반 예약 조건을 먼저 묻지 말고 질문 자체에 답한 뒤, 필요하면 코스·티·날짜를 한 가지씩 확인한다.
`;

const JAPAN_REGION_PATTERN = /홋카이도|아오모리|이와테|미야기|아키타|야마가타|후쿠시마|이바라키|도치기|군마|사이타마|지바|도쿄|가나가와|니가타|도야마|이시카와|후쿠이|야마나시|나가노|기후|시즈오카|아이치|미에|시가|교토|오사카|효고|나라|와카야마|돗토리|시마네|오카야마|히로시마|야마구치|도쿠시마|카가와|에히메|고치|후쿠오카|사가|나가사키|구마모토|오이타|미야자키|가고시마|오키나와|北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄/i;

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
  if (isGolfExpertQuestion(messages)) {
    return '전문 코스 정보는 골프장별·티 박스별·시즌별로 달라집니다. 정확한 코스명과 희망 티(블루·화이트·레드 등), 라운딩 시기를 알려주시면 코스 레이팅·야디지·그린 조건을 기준으로 확인해 드리겠습니다.';
  }
  const region = text.match(JAPAN_REGION_PATTERN) || text.match(/나리타|하코네|후지|규슈/i);
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
  return JAPAN_REGION_PATTERN.test(text) || /나리타|하코네|후지|규슈|([1-7])\s*(?:명|인)|8\s*(?:명|인)\s*이상|20\d{2}\s*(?:[-./]|년)\s*\d{1,2}\s*(?:[-./]|월)\s*\d{1,2}\s*(?:일)?|예산|\d[\d,\s]*(?:만\s*원|천\s*엔|원|엔)|[¥￥]\s*\d[\d,\s]*|JPY\s*\d[\d,\s]*/i.test(text);
}

function isGolfExpertQuestion(messages) {
  const text = textForConditionMatching(messages);
  return /핸디|handicap|hdcp|코스\s*레이팅|course\s*rating|슬로프|slope|티\s*(박스|마커|오프)|tee\s*(box|marker|off)|야디지|yardage|파\s*[3-5]|par\s*[3-5]|그린\s*스피드|stimp|잔디|벙커|해저드|도그레그|dogleg|캐디|셀프\s*플레이|카트|스루\s*플레이|점심\s*휴식|로컬\s*룰|에티켓|코스\s*공략|난이도/i.test(text);
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
  if (hasConsultationCondition(normalizedMessages) && !isGolfExpertQuestion(normalizedMessages)) {
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
          system_instruction: `${SYSTEM_PROMPT}\n${CONSULTATION_FLOW}\n${JAPAN_ADMINISTRATIVE_CONTEXT}\n${GOLF_EXPERT_CONTEXT}`,
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
