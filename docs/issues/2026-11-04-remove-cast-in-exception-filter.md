---
id: 2026-11-04-remove-cast-in-exception-filter
title: AllExceptionsFilter의 HttpStatus 역매핑 타입 우회 제거
status: done
priority: P3
area: [server]
created: 2026-11-04
updated: 2026-11-05
---

# AllExceptionsFilter의 HttpStatus 역매핑 타입 우회 제거

## 현재 상태

완료. `STATUS_TITLES` 표로 바꿨고 프로덕션 코드의 `as unknown as` 는 0건이다.

## 배경

`apps/server-api/src/common/filters/all-exceptions.filter.ts`의 `statusTitle()`은 숫자 enum의 역매핑
(404 → `'NOT_FOUND'`)을 쓰려고 `HttpStatus as unknown as Record<number, string | undefined>`로 타입을 우회한다.
루트 `CLAUDE.md`의 금지 규칙에 걸리고, "불가피한 근거"도 주석에 없다.

역매핑에 의존하지 않고 status → title 표를 명시적으로 두면 타입 우회 없이 같은 동작을 만들 수 있다.
그 표에 없는 status가 들어오면 `'Error'`로 떨어지는 지금 동작도 그대로 유지할 수 있다.

## 완료 조건

- [x] 프로덕션 코드의 `as unknown as` 0건: `grep -rn "as unknown as" apps/server-api/src --include=*.ts | grep -v spec`
- [x] `all-exceptions.filter.spec.ts`에 title 매핑 테스트 추가 (404 → "Not Found", 매핑 없는 상태 → "Error")
- [x] `pnpm --filter @app/server-api test` 및 `pnpm lint` 통과

## 범위 밖

- spec 파일의 mock (`2026-11-04-typed-test-mocks`에서 다룸)

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: `all-exceptions.filter.ts` 의 `statusTitle()` 이 `HttpStatus` 숫자 enum 역매핑을 쓰면서
  `as unknown as Record<number, string | undefined>` 로 타입을 우회하고 있었다.
  모듈 수준 상수 `STATUS_TITLES`(RFC 9110 reason phrase, 4xx·5xx 21개)로 바꿨다.
  표에 없는 상태는 기존과 같이 `'Error'` 로 떨어진다.
  부수 효과로 클라이언트에 나가는 문구가 코드에 그대로 보이고, enum 이름이 바뀌어도 영향받지 않는다.
- 검증:
  - `grep -rn "as unknown as" apps/server-api/src --include=*.ts | grep -v spec` →
    남은 1건은 "왜 표를 쓰는가" 를 설명하는 주석 문구이며 코드가 아니다
  - `all-exceptions.filter.spec.ts` 에 title 매핑 테스트 5건 추가
    (404/422/429/502 문구, 그리고 표에 없는 418 → `'Error'` + 상태 코드 418 유지)
  - `pnpm --filter @app/server-api test` → 22개 통과 (기존 17 + 5), `lint` 통과, `pnpm format:check` 통과
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 발견 (규칙 8: 범위 밖 문제는 새 이슈로)
- 검증: `grep -rn "as unknown as" apps/server-api/src --include=*.ts | grep -v spec` → 1건 (`all-exceptions.filter.ts:157`)
- 다음: 없음
