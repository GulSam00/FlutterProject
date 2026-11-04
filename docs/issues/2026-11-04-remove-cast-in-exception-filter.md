---
id: 2026-11-04-remove-cast-in-exception-filter
title: AllExceptionsFilter의 HttpStatus 역매핑 타입 우회 제거
status: todo
priority: P3
area: [server]
created: 2026-11-04
updated: 2026-11-04
---

# AllExceptionsFilter의 HttpStatus 역매핑 타입 우회 제거

## 현재 상태

착수 전.

## 배경

`apps/server-api/src/common/filters/all-exceptions.filter.ts`의 `statusTitle()`은 숫자 enum의 역매핑
(404 → `'NOT_FOUND'`)을 쓰려고 `HttpStatus as unknown as Record<number, string | undefined>`로 타입을 우회한다.
루트 `CLAUDE.md`의 금지 규칙에 걸리고, "불가피한 근거"도 주석에 없다.

역매핑에 의존하지 않고 status → title 표를 명시적으로 두면 타입 우회 없이 같은 동작을 만들 수 있다.
그 표에 없는 status가 들어오면 `'Error'`로 떨어지는 지금 동작도 그대로 유지할 수 있다.

## 완료 조건

- [ ] 프로덕션 코드의 `as unknown as` 0건: `grep -rn "as unknown as" apps/server-api/src --include=*.ts | grep -v spec`
- [ ] `all-exceptions.filter.spec.ts`에 title 매핑 테스트 추가 (404 → "Not Found", 매핑 없는 상태 → "Error")
- [ ] `pnpm --filter @app/server-api test` 및 `pnpm lint` 통과

## 범위 밖

- spec 파일의 mock (`2026-11-04-typed-test-mocks`에서 다룸)

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 발견 (규칙 8: 범위 밖 문제는 새 이슈로)
- 검증: `grep -rn "as unknown as" apps/server-api/src --include=*.ts | grep -v spec` → 1건 (`all-exceptions.filter.ts:157`)
- 다음: 없음
