# 신규 상담 의뢰 자동 확인 웹훅

고객이 `상담 의뢰 저장`을 완료하면 서버가 아래 이벤트를 HTTPS 웹훅으로 발송합니다.

```json
{
  "event": "consultation.received",
  "occurredAt": "2026-07-20T00:00:00.000Z",
  "request": {
    "id": 123,
    "name": "고객 이름",
    "contact": "연락처",
    "golf_date": "2026-09-10",
    "stay_end_date": "2026-09-13",
    "players": 4,
    "budget_per_person": 200000,
    "request": "AI가 정리한 상담 요약"
  }
}
```

Vercel Production 환경 변수 `ADMIN_REQUEST_WEBHOOK_URL`에 수신 시스템의 HTTPS 주소를 등록합니다. 저장 성공 여부와 무관하게 고객 접수는 유지되며, 관리자 화면의 `자동확인` 값이 `delivered`이면 수신 시스템 전송까지 완료된 상태입니다.
