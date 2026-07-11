---
type: dev
source: claude
project: jp-golf
system: JH-AI-Router
status: active
priority: P1
date: 2026-07-04
tags: [ai-api, stack, routing]
generated_by: jh-ai-api-router
---

# JP Golf — AI API 스택 선정 (2026-07-04)

> 요청: 시스템관리(Bucky)와 고객 대면 AI 에이전트를 분리, 고객 대면 에이전트는 유료 API 연결 예정, 가성비 우선, 가능하면 1순위 무료 API.
> 기준 문서: [[2026-06-23-2차-업데이트-기획]] (자연어 상담 에이전트), [[2026-06-26-3차-업데이트-인증-결제-정책]] (인증/결제/사용제한)
> 가격/한도는 2026-07-04 웹 검색으로 재확인함 (출처 하단 표기). Google 무료 티어 한도는 공지 없이 변경될 수 있어 재확인 필요.

---

## 1. 프로젝트 AI 기능 분류

| 기능 | 인증/결제 | 설명 |
|---|---|---|
| A. 프리모드 대화 | 불필요 | 인사·일반 대화, 일본 골프 기본 정보(시즌·인기 지역 등) |
| B. 의도 분류 게이트 | 불필요 | 사용자 메시지가 "일반 대화"인지 "골프여행 가이드 요청"인지 경량 분류 |
| C. 골프여행 가이드 모드 | 필수(인증+결제 9천~1만원) | 날짜/인원/지역/티오프시간 추출, 검색결과 정리·제시, 예약 확인 메시지 생성 |

Scope 아웃(이번 라운드 미포함, 과잉 추천 금지): 락쿠텐 고라 검색 연동 자체, 예약확인서 번역, 호텔/픽업/항공 에이전트 — 이들은 P1~P2 단계 검색/결제 모듈과 함께 별도 패킷에서 다룬다.

---

## 2. 추천 AI API 조합

| 기능 | 모델 | 무료 티어 | 유료 단가 (1M 토큰, in/out) | 비고 |
|---|---|---|---|---|
| A+B (프리모드+분류) 메인 | Gemini 2.5 Flash-Lite | O — Google 무료 티어 (2026-04부로 Pro는 무료 제외, Flash/Flash-Lite만 잔존) | $0.10 / $0.40 | 이미 `GOOGLE_AI_API_KEY` 보유, `scripts/gemini_client.py` 재사용 가능 |
| A+B 백업 | Groq `llama-3.1-8b-instant` | O — 14,400 req/day, 500K TPD (무료, 카드 불필요) | 저가 유료 전환 가능 | Gemini 한도초과/장애 시 폴백. 초저지연 |
| C (가이드모드, 유료 고객 응대) 메인 | Claude Haiku 4.5 | ✗ 무료 티어 없음 | $1.00 / $5.00 (배치 $0.50/$2.50, 캐시 히트 최대 90%↓) | 한국어 품질·지시이행 우수. 결제액(9천~1만원) 대비 세션당 원가는 미미 |
| C 백업/비용 방어 | Gemini 2.5 Flash | O(무료 있으나 가이드모드는 유료 권장) | $0.30 / $2.50 | Haiku 대비 저렴, 장애 시 폴백 또는 물량 급증 시 비용 방어용 |

주의: Google이 밝히듯 무료 티어 프롬프트는 모델 학습에 사용될 수 있음(유료 티어는 제외) — 결제 고객이 오가는 가이드모드(C)는 이 이유만으로도 무료 티어 대신 유료(Claude Haiku) 사용이 맞다.

---

## 3. 최종 추천 스택 (단계별)

1. **MVP (0원, 내부 검증)**: A/B/C 전부 Gemini 2.5 Flash-Lite 무료 티어로 프로토타입. 실 고객 결제 연결 전 플로우 검증용.
2. **베타 오픈 (첫 결제 고객부터)**: A/B는 Flash-Lite 무료 유지. **C(가이드모드)만 Claude Haiku 4.5 유료로 전환** — 실제 결제 고객 경험 품질 확보. Groq를 A/B 백업으로 연결.
3. **상용화 (트래픽 증가)**: A/B가 무료 한도(1,500 req/day) 근접 시 Groq 폴백 자동 전환 또는 Gemini 유료 전환. C는 Haiku 유지하되 프롬프트 캐싱·배치 처리로 원가 절감.

---

## 4. API 라우팅 구조

```
사용자 메시지
  → /api/chat/classify (Gemini 2.5 Flash-Lite, 무료)
     ├─ 일반 대화 → /api/chat/free (Flash-Lite, 실패 시 Groq 폴백)
     └─ 가이드 요청 시도
          → 인증 게이트(5종 소셜/휴대폰) 통과?
             └─ 아니오 → 인증 유도 메시지 (무료, LLM 호출 없음)
             └─ 예 → 결제 게이트(9천/1만원) 통과?
                  └─ 아니오 → 결제 유도 메시지 (무료, LLM 호출 없음)
                  └─ 예 → /api/chat/guide (Claude Haiku 4.5, 실패 시 Gemini 2.5 Flash 폴백)
```

인증/결제 유도 메시지는 고정 템플릿으로 처리하고 LLM을 호출하지 않는다 — 불필요한 비용 발생 지점 제거.

---

## 5. 백엔드 엔드포인트 설계

| 엔드포인트 | 모델 | 검증 |
|---|---|---|
| `POST /api/chat/classify` | Gemini 2.5 Flash-Lite | 없음 (레이트리밋만) |
| `POST /api/chat/free` | Gemini 2.5 Flash-Lite → Groq 폴백 | IP/세션당 일일 상한 |
| `POST /api/chat/guide` | Claude Haiku 4.5 → Gemini 2.5 Flash 폴백 | 인증 세션 토큰 + 결제 완료 플래그 필수 |
| `POST /api/auth/verify` | — | 5종 인증 콜백 (구글/카카오/네이버/라인/휴대폰) |
| `POST /api/payment/webhook` | — | 결제 게이트웨이(카카오페이/토스/네이버페이) 콜백 |

**중요 — 배포 아키텍처 공백**: 현재 `docs/jp-golf.html`은 GitHub Pages 정적 페이지라 서버사이드 시크릿 보관·API 호출이 불가능하다. 위 엔드포인트를 실제로 만들려면 별도 백엔드(Vercel Functions/Cloudflare Workers 등)가 필요하다. 이건 모델 선정과 별개의 결정이라 이번 패킷 범위에서는 제외했다 — 호스팅 결정 시 `jh-deploy` 스킬로 별도 요청 필요.

---

## 6. 환경변수 설계

```
GOOGLE_AI_API_KEY=      # 이미 보유 (Bucky Gemini 연동과 공유 가능하나, 별도 프로젝트 키 발급 권장 — 사용량 분리 추적)
GROQ_API_KEY=           # 신규 발급 필요 (무료)
ANTHROPIC_API_KEY=      # 신규 발급 필요 (Anthropic Console, Claude 구독과 무관한 별도 API 키)
```

전부 백엔드 서버 환경변수로만 저장. 프론트엔드(정적 페이지 포함) 코드/번들에 절대 포함 금지.

---

## 7. 보안 지침

- API Key는 백엔드 env에만 존재, 프론트엔드·저장소 커밋 금지
- 결제 완료 여부는 백엔드 세션 검증으로만 판단, 프론트 값 신뢰 금지
- 인증 콜백(구글/카카오/네이버/라인/휴대폰)은 각 제공자 서버 검증 후에만 세션 발급
- Anthropic API 키는 Claude Code/Claude 구독 계정과 별개로 Anthropic Console에서 신규 발급 (구독은 코딩 어시스턴트 전용, 프로덕트 백엔드에는 사용 불가)

---

## 8. 비용 통제 지침

- 무료모드(A/B): IP/세션당 일일 메시지 상한(예 20회) — Google 무료 한도(1,500 req/day 전체) 방어
- 가이드모드(C): 결제 완료 세션만 호출 허용, 세션당 최대 턴수 상한(예 30턴) — 원가 상한 고정
- 세션당 예상 원가: Haiku 기준 30턴 대화(약 3~5만 토큰 in/out 가정) ≈ $0.1~0.3 수준 — 결제액(9천~1만원, 약 $6.5~7.3) 대비 원가율 낮음
- 일일/월별 API 비용 로그를 Discord `jh-status` 채널에 요약 노출 검토 (기존 대시보드 관측성 패턴과 동일)

---

## 9. 데이터베이스 로그 구조 (제안)

```
chat_sessions(session_id, user_id NULL, mode[free|guide], started_at)
chat_messages(session_id, role, content, model_used, tokens_in, tokens_out, cost_usd, created_at)
payments(session_id, amount_krw, provider, status, paid_at)
```

`model_used`, `cost_usd`를 메시지 단위로 남겨야 8번 비용 통제와 폴백 전환 판단이 가능하다.

---

## 10. 개발 순서 (14단계)

1. `GOOGLE_AI_API_KEY` 프로젝트 전용 키 발급 (또는 기존 키 재사용 결정)
2. `GROQ_API_KEY` 신규 발급 (무료)
3. `ANTHROPIC_API_KEY` 신규 발급 (Anthropic Console)
4. 채팅 백엔드 호스팅 결정 (jh-deploy 스킬 별도 실행 — Vercel Functions 등)
5. `/api/chat/classify` 구현 (Flash-Lite)
6. `/api/chat/free` 구현 (Flash-Lite, Groq 폴백)
7. `/api/chat/guide` 스텁 구현 (Haiku 4.5, 인증 없이 우선 프로토타입 — 내부 QA용)
8. `chat_sessions`/`chat_messages` 스키마 적용
9. 토큰수·비용 계산 로깅 로직 추가
10. 무료모드 일일 상한 로직 적용
11. 인증 모듈(5종) 연동 — 3차 기획 문서 기준 별도 패킷
12. 결제 모듈(카카오페이/토스/네이버페이) 연동 — 3차 기획 문서 기준 별도 패킷
13. 가이드모드 세션 게이트(인증+결제 검증) 연결, 폴백(Gemini 2.5 Flash) 배선
14. 엔드투엔드 QA: 프리모드→유도메시지→인증→결제→가이드모드 전체 플로우

---

## 11. 최종 개발자 실행 지시문

지금 단계에서 진행할 것: 1~3번 키 발급, 5~7번 프로토타입(엔드포인트 3개)까지만. 가이드모드 실제 유료 호출은 11~13번(인증·결제 모듈) 완성 후 연결한다. 백엔드 호스팅이 정해지지 않았으므로 정적 GitHub Pages(`docs/jp-golf.html`)에 API 키를 직접 넣지 않는다.

---

## 12. 금지사항 확인

- [x] 무료 API라고 단정하지 않음 — 가이드모드는 처음부터 유료 권장, Google 무료 한도는 공지 없이 바뀔 수 있음을 명시
- [x] 공식 문서 확인 없이 무료 한도 확정 안 함 — 2026-07-04 웹 검색으로 재확인 (출처 하단)
- [x] 프론트엔드에 API Key 없음
- [x] 모든 기능 한 번에 넣지 않음 — 검색 연동/번역/호텔·픽업·항공 에이전트는 스코프 아웃
- [x] 사용하지 않을 API 과다 추천 안 함 — 후보 4개(메인 2 + 백업 2)로 제한
- [x] 고비용 모델을 기본값으로 두지 않음 — 무료/저가 모델을 기본, Haiku는 결제 확인된 가이드모드에만
- [x] 존재하지 않는 API 기능 언급 안 함
- [x] 사용자가 요청하지 않은 멀티에이전트 구조 강제 안 함

---

## 출처 (2026-07-04 웹 검색 확인)

- [Gemini API Free Tier 2026: 1,500 Req/Day, 1M TPM](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- [Google Gemini API free tier tightened: Pro models to become paid starting in April](https://help.apiyi.com/en/google-gemini-api-free-tier-changes-april-2026-guide-en.html)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Claude Haiku 4.5 API Pricing 2026](https://pricepertoken.com/pricing-page/model/anthropic-claude-haiku-4.5)
- [Introducing Claude Haiku 4.5 — Anthropic](https://www.anthropic.com/news/claude-haiku-4-5)
- [Groq API Free Tier Limits in 2026](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb)
- [Groq Free Tier Limits 2026: 30 RPM, 6K TPM, 14.4K Req/Day](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [Gemini 2.5 Flash / Flash-Lite API Pricing](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash)

[[jp-golf-hub]]
