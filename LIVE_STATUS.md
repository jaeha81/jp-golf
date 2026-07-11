# JP Golf Gate A — 현재 실사용 준비 상태

기준일: 2026-07-12 (KST)

## 완료된 항목

- 원본 `G:\내 드라이브\obsidian-agent-brain-system` 및 `G:\내 드라이브\Jh-golf`는 수정하지 않음.
- JP Golf 관련 파일과 필터링된 Git 이력을 임시 로컬 복제본에서 대상 저장소로 배치함.
- 로컬 커밋 3개 생성: `804de88`, `78c1ac0`, `628512b`.
- `api/golf-chat.js` 입력 검증, 길이 제한, rate limit, upstream 오류 비노출, Vercel body 파싱을 반영함.
- `tests/golf-chat.smoke.mjs` 통과.
- Vercel 프로젝트 `jp-golf` 생성 및 Preview 배포 완료.

## 현재 외부 상태

- Preview 배포: `https://jp-golf-ohqsafnbj-dltkddlf231-8261s-projects.vercel.app`
  - Vercel Authentication 보호 상태. 로그인된 브라우저에서 확인해야 함.
- Production 별칭 `https://jp-golf.vercel.app`는 키 미설정 상태에서의 오배포를 제거했으며 현재 404.
- `GEMINI_API_KEY`는 Preview/Production에 등록됨. AQ 인증 키를 legacy `generateContent` REST 경로로 호출하면 Google이 `API_KEY_INVALID`를 반환함.
- Git remote는 아직 없음. 원본 저장소로 push하지 않도록 의도적으로 비워 둠.

## 실제 사용 직전 사용자가 해야 할 입력

1. Vercel Dashboard의 `jp-golf` 프로젝트에서 `Settings → Environment Variables`로 이동.
2. 이름 `GEMINI_API_KEY`, 값은 Google AI Studio에서 발급한 키, 대상은 `Production`과 `Preview`를 선택해 저장.
   - 키 자체를 채팅에 붙여넣지 말 것.
3. 새로 만든 독립 GitHub 저장소 URL을 준비해 전달할 것. 원본 `obsidian-agent-brain-system` URL은 사용하지 않음.
4. 키 저장 후 Preview 재배포 및 POST `/api/golf-chat` 실사용 확인을 진행하고, 그 다음에만 Production 승격.

## 남은 승인 게이트

- Gemini API 키 입력 및 비용/쿼터 확인.
- 독립 GitHub 원격 저장소 생성·연결 여부.
- 실제 도메인과 서비스 약관/개인정보 문구 승인.
- 라이브 검색, 자동 예약, 결제, 관리자 큐는 MVP 이후 기능으로 별도 승인 필요.
- AQ 인증 키를 계속 사용할 경우 Google OAuth/서비스 계정 방식 또는 Interactions API 전환이 필요하며, 현재 Production은 오작동 공개를 막기 위해 제거됨.
