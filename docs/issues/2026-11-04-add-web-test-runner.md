---
id: 2026-11-04-add-web-test-runner
title: client-web 테스트 실행기 도입
status: done
priority: P2
area: [web]
created: 2026-11-04
updated: 2026-11-05
---

# client-web 테스트 실행기 도입

## 현재 상태

완료. Vitest 5.0.5 를 도입했고 `pnpm test` 에 포함된다. api-client 11건, fetchHealthReport 7건으로 총 18건.

## 배경

`apps/client-web/package.json`에 `test` 스크립트가 없어서, `pnpm test`는 웹 앱을 건너뛴다.
그 결과 다음 코드가 전혀 테스트되지 않는다.

- `lib/api/api-client.ts`: envelope 검증, problem+json 파싱, 타임아웃
- `features/health/api/health.api.ts`: 503 응답 본문을 데이터로 바꾸는 분기

이 코드들은 API 계약을 지키는 핵심이다. 그런데 서버(Jest)와 모바일에는 테스트가 있고 웹에만 없다.

## 완료 조건

- [x] 테스트 실행기 설치, `test` 스크립트 추가, turbo `test` 태스크에 포함됨
- [x] `api-client.ts` 테스트: 정상 envelope, 스키마 불일치 → contractViolation, problem+json → ApiError, 네트워크 오류
- [x] `fetchHealthReport` 테스트: 200, 유효한 details를 가진 503 → 데이터, details가 깨진 503 → 에러
- [x] `apps/client-web/CLAUDE.md`의 "테스트 실행기가 없다" 문장 교체
- [x] `pnpm test` 통과

## 범위 밖

- 컴포넌트 렌더링 테스트, E2E (Playwright)

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경:
  - `vitest@5.0.5` 설치, `vitest.config.mts`(environment node, `@/*` 별칭), `test`·`test:watch` 스크립트 추가
  - `src/lib/api/api-client.test.ts` 11건: envelope 언래핑, 버전 prefix URL, Accept 헤더,
    origin 끝 슬래시 중복 제거, undefined 쿼리 제외, data 스키마 불일치 → contractViolation,
    envelope 모양 불일치 → contractViolation, problem+json → ApiError(requestId·isClientError 보존),
    비표준 에러 본문(HTML 502) → ApiError, 네트워크 오류 → network, 호출자 취소는 감싸지 않고 전파,
    204 응답, POST 바디 직렬화
  - `src/features/health/api/health.api.test.ts` 7건: 200 그대로 반환, 503 details 승격,
    **축약된 details(상세 비공개 서버)도 승격**, details 계약 위반 → 전파, details 없는 503 → 전파,
    503 아닌 에러는 승격하지 않음, 네트워크 오류 전파
  - `turbo.json`: `@app/client-web#test` 의 `outputs` 를 빈 배열로. 커버리지를 만들지 않아
    매번 "no output files found" 경고가 났고, 진짜 캐시 설정 오류와 구분되지 않았다
  - `.prettierignore` 신규 + `format` 스크립트에 `--ignore-path .prettierignore` 추가.
    `pnpm install` 이 `pnpm-lock.yaml` 을 다시 쓰면 `format:check` 가 실패해서, 의존성을 추가한 사람마다
    무의미한 포맷 커밋을 만들어야 했다 (이번에 vitest 를 추가하며 실제로 겪었다). 포맷 대상에 `.mts` 도 추가
  - `apps/client-web/CLAUDE.md` 의 "테스트 실행기가 없다" 문장을 실행법·제약으로 교체
- 검증:
  - `pnpm --filter @app/client-web test` → 18개 통과 (약 0.3초)
  - `pnpm lint` 4/4, `pnpm typecheck` 5/5, `pnpm test` 3/3 (server 17 + web 18), `pnpm format:check` 통과
  - lint 오류 7건이 테스트 코드에서 나왔고, 규칙을 끄지 않고 코드로 해결했다:
    `String(url)` → `URL | Request | string` 을 좁히는 헬퍼, `components!` → `NonNullable<...>` 상수 분리,
    stub 의 reject 타입을 `Error` 로, 불필요한 `as` 제거
  - vitest 설정 파일을 `.ts` 로 두면 "ESM syntax in a file loaded as CommonJS" 경고가 나서 `.mts` 로 바꿨다
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 확인함
- 검증: `grep '"test"' apps/client-web/package.json` → 결과 없음
- 다음: 실행기 선택 (Vitest vs Jest: 서버와 같은 도구를 쓸지, ESM·Next 호환성을 우선할지)
