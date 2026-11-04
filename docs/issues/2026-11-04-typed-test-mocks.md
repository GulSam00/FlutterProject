---
id: 2026-11-04-typed-test-mocks
title: server-api 테스트 mock을 타입 안전한 방식으로 교체
status: todo
priority: P3
area: [server]
created: 2026-11-04
updated: 2026-11-04
---

# server-api 테스트 mock을 타입 안전한 방식으로 교체

## 현재 상태

착수 전. 루트 `CLAUDE.md`에 spec 파일 mock 예외를 임시로 두었다.

## 배경

spec 파일 3개(`health.service.spec.ts`, `all-exceptions.filter.spec.ts`, `transform.interceptor.spec.ts`)가
mock을 만들 때 `as unknown as`를 6번 쓴다. 이 방식은 대상 클래스의 인터페이스가 바뀌어도 mock이 계속 컴파일된다.
그래서 테스트가 통과하는데 실제 코드는 깨지는 상황을 막지 못한다.

## 완료 조건

- [ ] 방식 결정 (`jest-mock-extended`의 `mock<T>()` / 직접 만든 `Partial<T>` 기반 헬퍼)과 이유를 로그에 기록
- [ ] spec 파일의 `as unknown as` 0건: `grep -rn "as unknown as" apps/server-api/src --include=*.spec.ts`
- [ ] 루트 `CLAUDE.md` 금지 규칙에서 spec 예외 문장 제거
- [ ] `pnpm --filter @app/server-api test` 통과

## 범위 밖

- 프로덕션 코드의 `as unknown as` (`2026-11-04-remove-cast-in-exception-filter`에서 다룸)

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중, 루트 금지 규칙과 기존 spec 코드의 충돌을 확인함
- 검증: `grep -rn "as unknown as" apps/server-api/src --include=*.spec.ts` → 6건
- 다음: 방식 결정
