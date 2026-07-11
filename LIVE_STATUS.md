# JP Golf Gate A — 현재 실사용 상태

기준일: 2026-07-12 (KST)

## 완료된 항목

- 원본 `G:\내 드라이브\obsidian-agent-brain-system` 및 `G:\내 드라이브\Jh-golf`는 수정하지 않음.
- JP Golf 관련 파일과 필터링된 Git 이력을 임시 로컬 복제본에서 대상 저장소로 배치함.
- `api/golf-chat.js`를 Google Interactions API v1과 AQ Authorization Key 방식으로 전환함.
- 입력 검증, 길이 제한, rate limit, 15초 upstream timeout, 오류 상세 비노출을 반영함.
- `tests/golf-chat.smoke.mjs`에서 정상 응답, 입력 오류, rate limit, 네트워크 예외, 비JSON 응답, 대체 환경변수를 검증함.
- Vercel 프로젝트 `jp-golf` 생성, AQ 키 등록, Production 배포 완료.
- 브라우저에서 메시지 입력 → API 호출 → 한국어 응답 표시까지 실제 검증함.
- PWA manifest, 서비스워커, 아이콘을 루트 경로로 연결하고 설치 자산 응답을 확인함.
- 채팅창에 날짜 달력, 플레이 인원 선택, 1인당 예산 입력 UI를 추가함.
- 베타 기능보다 앞선 실시간 조회·예약 확정 표현을 공개 화면에서 제거함.

## 현재 외부 상태

- Production: `https://jp-golf.vercel.app`
- 최신 배포: `https://jp-golf-wpt8bfbo2-dltkddlf231-8261s-projects.vercel.app`
- 홈페이지: HTTP 200
- `POST /api/golf-chat`: HTTP 200, 정상 한국어 상담 응답 확인
- 브라우저 콘솔 오류: 없음
- `GEMINI_API_KEY`: Preview/Production에 암호화 등록됨
- Git remote: 없음. 보호 대상 원본 저장소로 push하지 않도록 비워 둠.

## 현재 사용 가능한 범위

- 지역·날짜·인원·예산을 묻는 한국어 AI 상담
- 예시 골프장·가격을 이용한 베타 상담 흐름
- 최종 예약은 공식 예약 페이지에서 사용자가 직접 진행한다는 안내

현재 제공하지 않는 기능: 실시간 티타임 조회, 자동 예약, 결제, 입금 확인, 취소·변경 처리, 관리자 큐.

## 남은 사업·수익화 게이트

- 독립 GitHub 원격 저장소 생성·연결 및 push.
- 실제 도메인 결정.
- 이용약관, 개인정보처리방침, 사업자 정보 확정.
- 제휴 예약처 계약과 실제 공식 예약 링크 확정.
- 실시간 코스·가격·재고 데이터 공급 방식 승인.
- 결제/수수료/제휴 전환 중 수익모델 선택과 구현.
- Gemini 비용·쿼터·오류율 모니터링 및 운영 알림 설정.

현재 단계는 **공개 베타 상담 서비스 사용 가능**이며, **자동 예약·결제 기반 수익화 운영은 아직 아님**.
