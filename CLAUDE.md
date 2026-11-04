# Monorepo 작업 규칙

## 구조

- `apps/server-api` (NestJS) · `apps/client-web` (Next.js) · `apps/client-mobile` (Flutter, pnpm 워크스페이스 밖)
- `packages/shared-types` = API 계약의 단일 원천. 응답 구조 변경은 여기부터 시작한다.
- `docs/issues/` = 작업 이슈 파일. 아래 "이슈 작업 절차"를 반드시 따른다.

## 이슈 작업 절차 (필수)

이슈는 `docs/issues/<YYYY-MM-DD>-<kebab-case-slug>.md` 파일 하나로 관리한다.
**파일 이름(확장자 제외)이 곧 이슈 ID**이고, frontmatter `id`와 같아야 한다. 날짜는 이슈를 만든 날이다.
형식은 `docs/issues/_TEMPLATE.md`를 복사해서 쓴다.

1. **이슈가 먼저다.** 동작·설정·API 계약·인프라를 바꾸는 작업은 해당 이슈 파일이 있어야 시작한다.
   없으면 템플릿으로 새로 만든다. 같은 이름의 파일이 이미 있으면 slug를 더 구체적으로 바꾼다.
   오타·포맷 수정만 하는 변경은 예외.
2. **시작할 때:** `## 현재 상태`와 최근 변경 로그를 읽고, `status`를 `in-progress`로, `updated`를 오늘 날짜로 바꾼다.
3. **변경사항이 생겼을 때 로그를 남긴다.** 커밋마다 남길 필요는 없다. 아래 중 하나가 생겼을 때 남긴다.
   - 상태가 바뀜 (`todo` / `in-progress` / `blocked` / `done`)
   - 완료 조건 항목을 체크하거나, 조건 자체를 추가·변경함
   - 설계·방식을 결정함 (무엇을 고르고 무엇을 버렸는지, 그 이유)
   - 막히는 문제나 범위 변경을 발견함
   - 검증을 실행함 (성공이든 실패든)

   새 항목은 `## 변경 로그`의 **맨 위(첫 번째)** 에 넣는다. 최신 항목이 항상 먼저 보이게 한다.
   로그가 설명하는 코드 변경이 있으면 **그 변경과 같은 커밋에 포함한다.** 형식:

   ```markdown
   ### YYYY-MM-DD · <브랜치명>

   - 변경: 무엇을 왜 바꿨는지 (주요 파일 경로 포함)
   - 검증: 실행한 명령 → 실제 결과 (실패했으면 실패 그대로 적는다)
   - 다음: 남은 작업 또는 막힌 이유 (없으면 "없음")
   ```

4. **`## 현재 상태`는 항상 최신으로 고쳐 쓴다.** 로그를 남길 때 함께 갱신한다. 지금 어디까지 됐고,
   무엇이 남았고, 무엇에 막혀 있는지를 3~5줄로 적는다. 이력은 로그에, 현재 상태는 이 섹션에 둔다.
5. **변경 로그 항목은 고치거나 지우지 않는다.** 정정은 새 항목으로 남긴다.
   병합 충돌이 나면 양쪽 항목을 모두 남기고, 날짜가 최신인 것이 위로 오게 정렬한다.
6. **커밋 본문 마지막에 이슈 ID를 trailer로 넣는다.** 예: `Issue: 2026-11-04-restrict-health-detail-exposure`.
   커밋 해시는 로그에 쓰지 않는다 (같은 커밋 안에서는 해시를 알 수 없다).
   대신 `git log --grep 'Issue: <id>'`로 찾는다.
7. **완료 판정:** `## 완료 조건`이 모두 체크되고 검증 명령이 통과했을 때만 `status: done`.
   검증하지 못한 항목이 있으면 `done`으로 바꾸지 말고, 이유를 로그에 적고 `blocked` 또는 `in-progress`로 둔다.
8. 범위 밖의 문제를 발견하면 현재 이슈에 섞지 말고 새 이슈 파일을 만든다.

상태 값: `todo` → `in-progress` → `done` (막히면 `blocked`). 조회:
`grep -H '^status:' docs/issues/[0-9]*.md`

## 검증 (작업 완료 전 실행하고 결과를 변경 로그에 기록)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`
- 모바일 변경: `pnpm mobile:analyze && pnpm mobile:test`
- 인프라 변경: `kustomize build infra/k8s/overlays/<dev|prod> | kubeconform -strict -summary -kubernetes-version 1.33.0`
- 실행 확인이 필요하면 `pnpm docker:up` 후 README의 Step 3 검증 명령

## API 계약 (깨면 클라이언트 3개가 동시에 깨진다)

- 성공 응답 `{ success, data, meta{timestamp, requestId, path} }`은 TransformInterceptor가 감싼다. 컨트롤러에서 직접 감싸지 않는다.
- 실패 응답은 RFC 7807 problem+json만 쓴다. `ProblemException` 계열로 던지고 `res.status().json()`을 직접 쓰지 않는다.
- `X-Request-ID`는 Nginx → Nest → 응답·로그까지 전파된다. 새 미들웨어나 프록시가 이 헤더를 지우지 않게 한다.
- Dart 모델(`apps/client-mobile/lib/core/network/api_response.dart`, `features/*/domain`)은 shared-types를 손으로 옮긴 사본이다.
  계약을 바꾸면 같은 커밋에서 Dart 쪽도 고친다.

## 금지

- TypeScript `any`, `as unknown as` 우회 (불가피하면 근거를 주석으로 남긴다)
- TypeORM `synchronize: true`. 스키마 변경은 반드시 migration으로 한다.
- liveness(`/health/live`)에 의존성 체크 추가. DB 장애 시 모든 Pod가 동시에 재시작된다.
- HPA가 관리하는 Deployment에 `replicas` 지정
- Ingress의 snippet annotation (CVE-2025-1974)
- `NEXT_PUBLIC_*`에 비밀값 (빌드 시 번들에 그대로 들어간다)
- "나중에 처리" 류의 TODO 주석. 에러는 그 자리에서 구체적으로 처리하거나, 이슈 파일로 남긴다.

## Git

- Conventional Commits (`feat` / `fix` / `chore` / `refactor` / `test` / `docs`), 본문에 `Issue: <id>` trailer
- 사용자가 요청하기 전에는 PR을 만들지 않는다.
