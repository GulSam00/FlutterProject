---
id: 2026-11-04-typed-test-mocks
title: server-api 테스트 mock을 타입 안전한 방식으로 교체
status: done
priority: P3
area: [server]
created: 2026-11-04
updated: 2026-11-05
---

# server-api 테스트 mock을 타입 안전한 방식으로 교체

## 현재 상태

완료. spec 파일의 `as unknown as` 는 0건이고, 루트 `CLAUDE.md` 의 임시 예외 문장도 제거했다.
테스트 더블은 `apps/server-api/src/test-support/` 의 `partialMock` 과 Nest 컨텍스트 빌더로 만든다.

## 배경

spec 파일 3개(`health.service.spec.ts`, `all-exceptions.filter.spec.ts`, `transform.interceptor.spec.ts`)가
mock을 만들 때 `as unknown as`를 6번 쓴다. 이 방식은 대상 클래스의 인터페이스가 바뀌어도 mock이 계속 컴파일된다.
그래서 테스트가 통과하는데 실제 코드는 깨지는 상황을 막지 못한다.

## 완료 조건

- [x] 방식 결정 (`jest-mock-extended`의 `mock<T>()` / 직접 만든 `Partial<T>` 기반 헬퍼)과 이유를 로그에 기록
- [x] spec 파일의 `as unknown as` 0건: `grep -rn "as unknown as" apps/server-api/src --include=*.spec.ts`
- [x] 루트 `CLAUDE.md` 금지 규칙에서 spec 예외 문장 제거
- [x] `pnpm --filter @app/server-api test` 통과

## 범위 밖

- 프로덕션 코드의 `as unknown as` (`2026-11-04-remove-cast-in-exception-filter`에서 다룸)

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경:
  - `src/test-support/partial-mock.ts`: `partialMock<T>(impl: Partial<T>): T`.
    단언을 한 곳으로 모으고 호출 지점은 `Partial<T>` 로 검사받는다 (의존성 추가 없음)
  - `src/test-support/nest-context.ts`: `createExecutionContext`, `createArgumentsHost`,
    `createAdapterHarness`. `ExecutionContext.getType<TContext>()` 처럼 Nest 컨텍스트 인터페이스의
    메서드가 **제네릭**이라 `Partial<T>` 로는 구체 반환값을 할당할 수 없다(`'http'` 를 `TContext` 에 할당 불가).
    그래서 이 경우에만 필요한 단언을 이 파일 한 곳에 모으고 이유를 주석으로 남겼다
  - spec 3개(`health.service`, `all-exceptions.filter`, `transform.interceptor`)를 전환.
    필터 spec 은 어댑터·컨텍스트 조립 20줄이 빌더 호출 4줄로 줄었다
  - `tsconfig.build.json` 의 `exclude` 에 `src/test-support/**` 추가.
    빼지 않으면 테스트 헬퍼가 `dist` 와 운영 이미지에 함께 실려 나간다
  - 루트 `CLAUDE.md` 의 spec 예외 문장 제거, `apps/server-api/CLAUDE.md` 에 "테스트" 절 추가
- 검증:
  - `grep -rn "as unknown as" apps/server-api/src --include=*.spec.ts` → **0건**
  - **효과 확인**: `partialMock<DatabaseHealthIndicator>` 의 키를 `check` → `probe` 로 일부러 바꾸니
    `error TS2353: ... 'probe' does not exist in type 'Partial<DatabaseHealthIndicator>'` 로 컴파일 실패.
    전환 전에는 같은 오타가 조용히 통과했다. 되돌린 뒤 typecheck 다시 통과
  - 빌드 산출물에 헬퍼가 없음: `ls apps/server-api/dist/test-support` → No such file or directory
  - `pnpm lint` 4/4, `pnpm typecheck` 5/5, `pnpm test` 3/3 (server 22 + web 18), `pnpm format:check` 통과
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중, 루트 금지 규칙과 기존 spec 코드의 충돌을 확인함
- 검증: `grep -rn "as unknown as" apps/server-api/src --include=*.spec.ts` → 6건
- 다음: 방식 결정
