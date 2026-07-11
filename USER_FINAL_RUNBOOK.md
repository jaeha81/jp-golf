# JP Golf 사용자 최종 실행 가이드

이 문서는 Codex가 대신하지 않고 사용자가 직접 수행할 마지막 단계의 순서와 성공 기준을 설명한다.

## 0. 현재 위치

- 대상 폴더: `D:\ai프로젝트\jp-golf`
- 정본 호스트 결정: Vercel
- 현재 상태: 내부 검증 완료, 공개 배포 전
- 현재 Git 상태: 변경사항이 아직 commit되지 않음
- G: 원본과 `Jh-golf` 원본은 건드리지 않음

## 1. 먼저 파일을 검토한다

다음 파일을 열어 변경 내용을 확인한다.

- `api/golf-chat.js`
- `docs/jp-golf.html`
- `vercel.json`
- `GATE_B_DECISION.md`
- `SECURITY_PROGRESS.md`
- `FINAL_HANDOFF.md`

PowerShell:

```powershell
Set-Location 'D:\ai프로젝트\jp-golf'
git status --short --branch
git diff -- api/golf-chat.js docs/jp-golf.html
```

## 2. 로컬 preflight를 실행한다

Node.js가 설치되어 있다면:

```powershell
node --check api/golf-chat.js
node tests/golf-chat.smoke.mjs
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json valid')"
git diff --check
```

성공 기준:

- `JP Golf API smoke tests passed`
- `vercel.json valid`
- `git diff --check`에 출력 없음

## 3. Vercel 프로젝트를 만든다

1. [Vercel New Project](https://vercel.com/new)를 연다.
2. Git 저장소를 연결하거나, 사용자 승인 후 이 폴더를 Vercel CLI로 연결한다.
3. 프로젝트 Root Directory가 `jp-golf` 대상 폴더인지 확인한다.
4. `vercel.json`이 포함된 상태에서 Preview 배포를 먼저 선택한다.

Vercel 프로젝트 설정은 [Projects 문서](https://vercel.com/docs/projects)를 참고한다.

## 4. 환경변수를 입력한다

Vercel 프로젝트에서 `Settings → Environment Variables`로 이동한다.

필수:

```text
GEMINI_API_KEY=<Google AI Studio에서 발급한 실제 키>
```

선택:

```text
JP_GOLF_GEMINI_MODEL=gemini-2.5-flash-lite
```

Preview와 Production 환경을 구분해 입력한다. 키를 저장소 파일, `.env`, HTML, 로그에 넣지 않는다. Vercel 환경변수는 새 배포부터 적용된다. 자세한 내용은 [Vercel 환경변수 문서](https://vercel.com/docs/environment-variables)와 [CLI env 문서](https://vercel.com/docs/cli/env)를 따른다.

## 5. Preview에서 확인한다

Preview URL에서 다음을 확인한다.

| 확인 | 성공 기준 |
|---|---|
| `/` | 베타 데모 페이지가 열림 |
| `/api/golf-chat` GET | 405 응답 |
| 정상 POST | 상담 응답 200 |
| 잘못된 `messages` | 400 응답 |
| 같은 IP 21회 초과 | 429 응답 |
| 상류 API 오류 | 502이지만 원문·키 미노출 |
| API URL | `?key=`가 없어야 함 |
| 응답 헤더 | `Cache-Control: no-store` |

브라우저 개발자 도구 Network 탭에서 API 요청 URL과 응답을 확인한다. API 키 값 자체는 화면·Network·로그에 남으면 안 된다.

## 6. 공개 전 반드시 확인한다

다음 항목이 하나라도 미확정이면 Production 배포를 하지 않는다.

- 인증/세션과 결제 흐름
- 분산 환경용 rate limit 저장소
- Rakuten GORA·Accordia·PGM ToS 원문과 법률 검토
- 사업 책임자 승인
- 모바일 E2E 및 롤백 검증
- 실제 자동 검색·자동 예약을 허용할 법적·사업적 근거

현재 MVP는 예시 정보 상담과 공식 예약 페이지 연결까지만 제공한다. 실제 자동 예약·결제·수익화 기능으로 표현하면 안 된다.

## 7. 최종 배포는 사용자가 결정한다

위 검토와 승인을 모두 마친 뒤에만 사용자가 직접 다음을 결정한다.

```powershell
git add api/golf-chat.js docs/jp-golf.html vercel.json tests USER_FINAL_RUNBOOK.md
git commit -m "Prepare JP Golf beta for Vercel preview"
git push
vercel --prod
```

Codex는 이 handoff 단계에서 commit, push, deploy를 실행하지 않는다.
