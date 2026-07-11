# Gate B 결정 기록

> 상태: **확정 / 상용화 HOLD**  
> 확정일: 2026-07-11 (KST)  
> 기준 상태 문서: `PROJECT_STATE.md`

## 확정 사항

- 고객용 정본 호스트는 **Vercel**로 한다.
- GitHub Pages는 정적 보조/데모 경로로만 유지하며 고객용 정본으로 취급하지 않는다.
- 동적 API는 현재 `api/golf-chat.js`를 기준으로 Vercel Function 방향을 유지한다.
- MVP는 Gemini 2.5 Flash-Lite 기반 비스트리밍 베타 상담, 예시 데이터, 제휴사 공식 예약 페이지 연결까지다.
- 인증·결제·실시간 공급사 검색·자동 예약·관리자 검수 큐는 MVP에서 제외하고 후속 범위로 둔다.
- 현행 모델은 Gemini 2.5 Flash-Lite이며, Claude Haiku 4.5는 유료 가이드모드 계획이다.
- Sonnet 4.6/SSE 기록은 오류로 정정하며, 현행 API는 비스트리밍이다.
- 고객 문구는 베타·예시 데이터임을 유지하고 실제 검색·예약·결제 완료처럼 표현하지 않는다.

## 계속 HOLD인 항목

- API 인증, 레이트리밋·쿼터, 입출력 상한, 오류 원문 비노출
- Gemini 키 URL 쿼리 전달 제거 및 운영 로그 점검
- Rakuten GORA·Accordia·PGM ToS 원문과 법률 검토
- 사업 책임자 승인 기록 및 Gate C 스테이징 QA

이 기록은 결정을 고정하지만 commit, push, deploy 또는 상용화 승인을 의미하지 않는다.
