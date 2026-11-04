---
id: 2026-11-04-add-web-test-runner
title: client-web 테스트 실행기 도입
status: todo
priority: P2
area: [web]
created: 2026-11-04
updated: 2026-11-04
---

# client-web 테스트 실행기 도입

## 현재 상태

착수 전. Vitest를 1순위 후보로 보고 있다.

## 배경

`apps/client-web/package.json`에 `test` 스크립트가 없어서, `pnpm test`는 웹 앱을 건너뛴다.
그 결과 다음 코드가 전혀 테스트되지 않는다.

- `lib/api/api-client.ts`: envelope 검증, problem+json 파싱, 타임아웃
- `features/health/api/health.api.ts`: 503 응답 본문을 데이터로 바꾸는 분기

이 코드들은 API 계약을 지키는 핵심이다. 그런데 서버(Jest)와 모바일에는 테스트가 있고 웹에만 없다.

## 완료 조건

- [ ] 테스트 실행기 설치, `test` 스크립트 추가, turbo `test` 태스크에 포함됨
- [ ] `api-client.ts` 테스트: 정상 envelope, 스키마 불일치 → contractViolation, problem+json → ApiError, 네트워크 오류
- [ ] `fetchHealthReport` 테스트: 200, 유효한 details를 가진 503 → 데이터, details가 깨진 503 → 에러
- [ ] `apps/client-web/CLAUDE.md`의 "테스트 실행기가 없다" 문장 교체
- [ ] `pnpm test` 통과

## 범위 밖

- 컴포넌트 렌더링 테스트, E2E (Playwright)

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 확인함
- 검증: `grep '"test"' apps/client-web/package.json` → 결과 없음
- 다음: 실행기 선택 (Vitest vs Jest: 서버와 같은 도구를 쓸지, ESM·Next 호환성을 우선할지)
