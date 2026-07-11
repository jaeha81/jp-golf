# JP Golf 안전 이관 매니페스트

> 상태: **PRE-MIGRATION / HOLD**  
> 작성 시각: 2026-07-11 15:20 KST  
> 작성 목적: JP Golf의 코드, Git 이력, 기획 문서, 상용화 자료, OCI 핸드오프를 독립 프로젝트로 옮기기 전에 정본과 무결성 기준을 고정한다.  
> 현재 결론: `D:\ai프로젝트\jp-golf`는 이 매니페스트 외 실제 자산이 아직 이관되지 않은 대상 폴더이며, 승인 전까지 정본이 아니다.

## 1. 작업 경계

### 원본

- Git 코드 원본: `G:\내 드라이브\obsidian-agent-brain-system`
- 비-Git 사업 자료 원본: `G:\내 드라이브\Jh-golf`
- OCI 원본: `/opt/ai-os` (사용자 전달 내용으로만 확인, 이 PC에서 직접 검증하지 못함)
- 구형 비교본: `D:\ai프로젝트\obsidian-agent-brain-system` (최신 정본으로 사용 금지)

### 대상

- `D:\ai프로젝트\jp-golf`
- 이 문서 작성 전 파일, 하위 폴더, `.git` 모두 0건이었다.

### 승인 전 금지

- G: 또는 OCI 원본 삭제, 이동, 이름 변경, 덮어쓰기
- Git 이력 재작성, reset, clean, 자동 정리
- 실제 자산 복사, 새 Git 저장소 초기화, commit, push, deploy
- Vercel/GitHub Pages/DNS 또는 Bucky·Discord 프로젝트 경로 전환
- Rakuten GORA·Accordia·PGM 크롤링 및 브라우저 자동화 착수

## 2. Git 기준선

검증 시점의 모노리포 상태:

| 항목 | 값 |
|---|---|
| 원격 | `https://github.com/jaeha81/obsidian-agent-brain-system.git` |
| G: 현재 브랜치 | `bucky-os-v3-core` |
| G: 관측 HEAD | `360216f5d715339f3beca54d43d88a9f3dd705cf` |
| 원격 `bucky-os-v3-core` | `360216f5d715339f3beca54d43d88a9f3dd705cf` |
| 원격 `master` | `fd1e57fc65ecedb69b0c17fac241512752ce448b` |
| JP Golf 최신 코드 전환 커밋 | `37737b3cdefe2e2ddc13a963653e4193760cc8f6` |

`37737b3`은 원격 `master`와 `bucky-os-v3-core` 양쪽의 조상이다. 모노리포 HEAD는 다른 시스템 작업으로 계속 이동하므로, JP Golf 이관 기준은 전체 HEAD가 아니라 아래 파일별 Git blob과 체크섬으로 고정한다.

| 파일 | Git blob | 마지막 관련 커밋 | 상태 |
|---|---|---|---|
| `api/golf-chat.js` | `f03f4214ba4c21cc76b11c029e0a1379d3c44a80` | `37737b3` | 추적, clean |
| `docs/jp-golf.html` | `d69fc0205562ce700f48fc687c51e21b6948d323` | `c9afc62` | 추적, clean |
| `vercel.json` | `5a2ece33de489863b09efed0fae0941b8e5e4383` | `df55fc5` | 추적, clean, 모노리포 공용 설정 |

최소 보존 체크포인트:

| 커밋 | 의미 |
|---|---|
| `08647ef` | 초기 JP Golf 대시보드 추가 |
| `d577556` | 2차 자연어 상담 방향 반영 |
| `60b23f9` | 2차 고객 예약 페이지 재설계 |
| `ba5c6b6`, `425a589` | 상담 말투 및 사용자 피드백 반영 |
| `a83c7bb` | 상용화 차단 P0 6종 수정 |
| `3bd2aeb` | Claude API 연동. 실제 런타임은 Haiku 4.5, 비스트리밍 |
| `c9afc62` | 대량 삭제 이후 대시보드 복원 |
| `a6ae70b` | `golf-chat` 엔드포인트 재추가 |
| `37737b3` | Gemini 2.5 Flash-Lite로 전환한 현행 기준 |

주의: `D:\ai프로젝트\obsidian-agent-brain-system`은 `37737b3` 객체가 없고 Haiku 코드에 머문 구형 복제본이므로 이관 소스로 사용하지 않는다.

## 3. 이관 자산 무결성 목록

아래 SHA-256은 원본 파일 바이트 기준이다. 총 13개, 3,292,260바이트다.

| # | 원본 기준 상대 경로 | 바이트 | SHA-256 | Git 상태 | 포함 결정 |
|---:|---|---:|---|---|---|
| 1 | `api/golf-chat.js` | 3,044 | `25F560BF242DE5E6C0AF0B85376374474BB3EE3F4B56B1D12F85FDBAB6D0F19E` | 추적, clean | 필수 코드 |
| 2 | `docs/jp-golf.html` | 46,238 | `8BDD125F54EAB8368A7DB6B190E7A206FF06B25F5FC8496EE84B07787B1F8CD2` | 추적, clean | 필수 프론트엔드 |
| 3 | `vercel.json` | 2,130 | `9AFCAFA2E0E7BE466CA683E0FBD7BAC65950B35259A411F292134F0331411AF2` | 추적, clean | 참조용. 공용 설정을 그대로 사용하지 않음 |
| 4 | `scripts/jp_golf_local_test_server.py` | 5,763 | `D55074750D33E2BF831F073FEF8A8892AC668682A338365D45C074B6F2A8514F` | 미추적, 무시되지 않음 | 개발 도구 후보, 별도 승인 |
| 5 | `ObsidianVault/03_Projects/jp-golf/2026-06-23-2차-업데이트-기획.md` | 4,825 | `C992940194AFEBA698964F491F659951CF44960B1E5539587DDE165021D2549F` | `.gitignore:82` | 필수 프로젝트 기억 |
| 6 | `ObsidianVault/03_Projects/jp-golf/2026-06-26-3차-업데이트-인증-결제-정책.md` | 4,878 | `98CFF68E84054B8AD8CC396008A9996F8BA9FF14AE18B75362080732D922A30D` | `.gitignore:82` | 필수 프로젝트 기억 |
| 7 | `ObsidianVault/03_Projects/jp-golf/2026-07-04-4차-업데이트-신청서-관리자검수-플로우.md` | 9,689 | `EECAB1C150405E99FC5024E1F42F015B97AD390634FCD1929E5EEBFDE5B1BA48` | `.gitignore:82` | 필수 프로젝트 기억 |
| 8 | `ObsidianVault/03_Projects/jp-golf/2026-07-04-ai-api-stack.md` | 10,660 | `4EAAC08264E4B42789BCFBEB2C249E061F91B463407278B912BE4CC0C08DD296` | `.gitignore:82` | 필수 프로젝트 기억 |
| 9 | `ObsidianVault/00_System/HANDOFF_LOG.md` | 7,713 | `502A81EC921D94BF00D5166CFCA00660AE32AA40BF1AF97B6AB7FCC960A020C8` | `.gitignore:45` | 참조용. 파일 전체 덮어쓰기 금지, JP Golf 항목만 병합 |
| 10 | `JP_Golf_상용화전_업데이트_요청서_v1.docx` | 51,862 | `362886D83024F9D6861F315BCBA195C32F54E62C2C332E0BB64730120083F7DE` | 비-Git | 필수 사업 원본 |
| 11 | `음성보안사항/20260626095931.m4a` | 1,215,247 | `6CB0165CE2D7371EC77539C880E454F6020EBC283C3E324F3DB541A6BB8F8D01` | 비-Git | 원본 보존, 내용 재검증 대기 |
| 12 | `음성보안사항/20260626100045.m4a` | 725,666 | `25CC7188BAEC2496E544D013C0A8B29EE710AEE11A33CBEE77BBC62759E44FA3` | 비-Git | 원본 보존, 내용 재검증 대기 |
| 13 | `음성보안사항/20260626100410.m4a` | 1,204,545 | `FA5F4475EF2CA537FE41AD3E02C4F0EE5D3CBB2A0E9E8528110B3FBE85D36E9D` | 비-Git | 원본 보존, 내용 재검증 대기 |

체크섬 사용 주의: Git checkout 과정에서 줄바꿈이 정규화될 수 있으므로 추적 파일은 Git blob을 1차 기준으로, 원본 바이트 복사는 SHA-256을 1차 기준으로 검증한다.

## 4. OCI 7/11 핸드오프 상태

사용자가 전달한 식별자:

- `HANDOFF-20260711-JP-GOLF-STATUS-CONSOLIDATION`

현재 G:/D:의 `HANDOFF_LOG.md`와 대상 검색에서 이 항목을 찾지 못했다. 따라서 다음과 같이 취급한다.

- 상태: **원문 미확보 / 사용자 전달 요약만 존재**
- `/opt/ai-os`에서 원문 파일, 작성 시각, 출처 경로, SHA-256을 확보하기 전 기존 `HANDOFF_LOG.md`에 병합하지 않는다.
- 기존 G: `HANDOFF_LOG.md` 전체를 OCI 파일로 덮거나 반대로 OCI 파일을 G: 파일로 덮지 않는다.
- 원문 확보 후 JP Golf 항목 단위로 중복·시간순서를 검증해 별도 병합한다.

사용자 전달 요약 중 로컬 검증으로 정정된 핵심:

- OCI에 독립 JP Golf 저장소가 없다는 설명은 OCI 환경에 한해 맞다.
- 홈 PC 실제 코드는 독립 저장소가 아니라 G: Obsidian 모노리포 안에 있다.
- 6/26 런타임은 Sonnet 4.6이 아니라 Haiku 4.5였고 SSE가 아니었다.
- 7/04 이후 현행 런타임은 Gemini 2.5 Flash-Lite다.

## 5. 현재 제품 기준

| 영역 | 현재 사실 | 상태 |
|---|---|---|
| 고객 UI | `docs/jp-golf.html` 베타 데모 | 구현됨 |
| 채팅 API | 비스트리밍 `POST /api/golf-chat` | 구현됨 |
| 현재 모델 | `gemini-2.5-flash-lite` | 구현됨 |
| 미래 유료 가이드 모델 | Claude Haiku 4.5 | 계획만 존재 |
| Sonnet 4.6 / SSE | 과거 핸드오프의 잘못된 기록 | 정정 필요 |
| 공급사 실시간 검색 | 고정 예시 데이터만 존재 | 미구현 |
| `/api/chat/classify`, `/free`, `/guide` | 설계 문서에만 존재 | 미구현 |
| 6항목 예약신청서 | 확정 문서에만 존재 | 미구현 |
| 인증·결제 | 확정/계획 문서에만 존재 | 미구현 |
| 매 건 관리자 검수 큐 | 확정 문서에만 존재 | 미구현 |
| 고객 결과 전달 채널 | 4차 범위에서 보류 | 미확정 |
| 자동화 테스트 | 없음 | 미구현 |
| 크롤링 | ToS 확인 전 HOLD | 착수 금지 |
| 고객용 정본 호스트 | GitHub Pages와 Vercel 혼재 | 미확정 |

호스팅 사실:

- GitHub Pages와 Vercel 모두 동일한 정적 페이지를 공개한다.
- 프론트엔드는 절대경로 `/api/golf-chat`을 사용하므로 동적 채팅은 Vercel 전제다.
- `vercel.json`은 Obsidian 모노리포 공용 설정이므로 독립 프로젝트용 설정을 별도로 설계해야 한다.

## 6. 상용화 차단 조건

출시 상태는 **HOLD**다. 다음 항목이 해결되기 전 상용 공개, 광고 유입 확대, Bucky 자동 개발 재개를 완료로 처리하지 않는다.

### P1 보안

- 공개 API 인증 또는 적절한 세션 검증 없음
- IP/세션 레이트리밋과 일일 쿼터 없음
- 메시지 개수·길이 및 출력 토큰 상한 없음
- Gemini 키를 URL 쿼리 문자열로 전달
- 상류 API 오류 원문을 클라이언트에 반환
- 운영 키의 URL/관측 로그 노출 점검 및 필요 시 키 회전 필요

### 상용 표현

- 페이지 일부가 데모라고 고지하면서 실시간 검색, 자동 예약, 입금 자동 확인 등 미구현 기능을 현재 기능처럼 표현한다.
- 상용화 요청서의 HOLD 조건과 QA 체크리스트를 다시 통과해야 한다.

### ToS·법률

- Rakuten GORA, Accordia, PGM의 정확한 대상 URL과 ToS 원문 미확보
- robots.txt 허용 여부만으로 상업적 자동수집을 허용한다고 판단하지 않음
- 원문 및 법률 검토 승인 전 크롤링·Playwright 자동화 금지

## 7. 이관 승인 게이트

### Gate A — 자산 복사 승인

사용자가 다음을 확정한 뒤에만 실제 복사를 시작한다.

- 13개 자산별 포함/제외 결정
- 독립 저장소 디렉터리 구조
- Git 이력 보존 방식
- OCI 7/11 원문 확보 또는 보류 결정
- 비밀값과 `.env`는 이관 목록에서 제외하고 대상 환경에서 별도 발급·주입

검증 기준:

- 원본 파일 수·크기·SHA-256 유지
- 추적 파일 Git blob 일치
- 원본 G:/OCI 무변경
- 대상에 예상하지 않은 OABS 파일이 섞이지 않음

### Gate B — 제품 기준 승인

- 단일 `PROJECT_STATE.md`에서 모델, 구현/미구현, 호스팅, 상용 문구, ToS 상태를 확정
- 6/26 핸드오프의 Sonnet/SSE 오류 정정
- Vercel을 고객용 정본으로 할지, 별도 백엔드를 둘지 결정
- 사업 책임자 승인 전 구현 완료로 표시하지 않음

### Gate C — 상용화·컷오버 승인

- P1 API 보안 수정
- ToS/법률 검토
- 스테이징 E2E 및 모바일 QA
- 롤백 절차 검증
- 이후에만 D: 정본 선언, 배포/DNS 변경, Bucky·Discord 경로 전환

하나라도 미통과이면 기존 원본을 보존하고 컷오버하지 않는다.

## 8. 관측된 운영 지침 누락

JP Golf 선택기가 참조한 다음 패킷은 D:와 G: 양쪽에서 찾지 못했다.

- `ObsidianVault/06_Context_Packs/bucky-user-communication-output-policy.md`

다음 Bucky/Discord 이관 단계에서 선택기 참조를 수정하거나 원본을 복구해야 한다. 이번 매니페스트 단계에서는 변경하지 않는다.

## 9. 이번 단계 완료·미완료

### 완료

- 최신 JP Golf Git 기준과 원격 포함 여부 검증
- 13개 이관 자산 존재·크기·SHA-256 고정
- 현재 모델, 구현/미구현, 호스팅, ToS, 보안 차단 조건 기록
- OCI 7/11 핸드오프의 로컬 부재 기록

### 미완료

- 실제 자산 복사
- 독립 Git 저장소 생성
- 프로젝트 디렉터리 구조 확정
- OCI 원문 확보 및 병합
- 코드 수정, 테스트, commit, push, deploy
- Bucky·Discord 작업 경로 전환

다음 행동은 Gate A 승인 후 독립 저장소 구조와 복사 계획을 확정하는 것이다.
