# client-web 규칙

공통 규칙(API 계약, 금지 사항, 이슈 절차)은 루트 `CLAUDE.md`에 있다. 여기에는 이 앱에서만 통하는 규칙을 둔다.

## 명령

- 개발 서버: `pnpm --filter @app/client-web dev` (포트 3001)
- 타입 체크: `pnpm turbo run typecheck --filter=@app/client-web`
  - `tsc`가 `next build`가 만드는 `.next/types`를 읽어서, turbo가 빌드 후에 실행하도록 순서를 고정해 두었다.
    `tsc --noEmit`을 바로 돌리면 빌드 전에는 실패할 수 있다.
- 테스트: **아직 테스트 실행기가 없다.** 임의로 설치하지 않는다.
  도입은 `docs/issues/2026-11-04-add-web-test-runner.md`에서 다룬다.

## 구조

```
src/
├── app/                      # 라우트. features의 queryOptions로 SSR 미리 가져오기 + HydrationBoundary 조립까지만 (app/health/page.tsx 참조)
├── features/<name>/
│   ├── api/<name>.api.ts     # fetch 함수: (client: ApiClient, ...) → Zod로 검증된 데이터
│   ├── api/<name>.queries.ts # queryKey 팩토리 + queryOptions 팩토리
│   └── components/
├── components/ui/            # 도메인을 모르는 공용 UI
└── lib/                      # api 클라이언트, env, query client
```

## API 호출

- **API 클라이언트는 실행 위치에 따라 다르다.**
  - 서버 컴포넌트, Route Handler: `lib/api/server-client.ts`의 `getServerApiClient()`.
    내부 주소(`API_INTERNAL_URL`)를 쓰고 `server-only`라 클라이언트 번들에 들어가지 않는다.
  - 클라이언트 컴포넌트: `lib/api/browser-client.ts`의 `browserApiClient` (공개 주소 `NEXT_PUBLIC_API_URL`)
- **fetch 함수와 queryOptions 팩토리는 `ApiClient`를 인자로 받는다.** 팩토리 안에서 클라이언트를 직접 import하지 않는다.
  예: `healthReportQueryOptions(client)`. 같은 queryKey를 SSR 미리 가져오기와 브라우저 재조회가 함께 쓰기 위해서다.
  팩토리 안에서 `browserApiClient`를 import하면, SSR이 공개 주소로 나갔다가 다시 들어오는 경로를 타게 된다
  (네트워크 비용 증가, K8s NetworkPolicy에 막힐 수 있음).
- 모든 응답은 `client.get(path, schema)`처럼 Zod 스키마로 검증한다. 스키마는 `@repo/shared-types`의 것을 쓴다.
  검증에 실패하면 `ApiError.contractViolation`이 된다. 검증을 건너뛰는 경로를 만들지 않는다.
- queryKey 문자열을 컴포넌트에서 직접 쓰지 않는다. `<name>.queries.ts`의 키 팩토리(`healthKeys` 등)를 쓴다.
- 에러 상태 코드인데 본문이 유효한 데이터인 경우(헬스체크 503처럼)는 `features/health/api/health.api.ts`의
  `fetchHealthReport` 방식을 따른다. 에러 본문의 `details`를 스키마로 검증한 뒤 데이터로 돌려준다.

## 환경변수

- 정의와 검증은 `src/lib/env.ts` 한 곳에서 한다. 공개 변수는 `publicEnv`, 서버 전용 변수는 `getServerEnv()`.
- `NEXT_PUBLIC_*`는 **빌드할 때** 번들에 문자열로 박힌다. 새로 추가하면 다음 두 곳도 함께 고친다.
  1. `infra/docker/Dockerfile.web`의 `ARG` / `ENV`. 빠뜨리면 이미지 안에서는 값이 비어 있다.
  2. `.env.example`
- `process.env.NEXT_PUBLIC_X`는 리터럴로 접근한다. `process.env[key]`처럼 동적으로 접근하면 치환되지 않는다.
