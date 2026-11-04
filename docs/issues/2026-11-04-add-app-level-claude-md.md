---
id: 2026-11-04-add-app-level-claude-md
title: 앱별 CLAUDE.md 작성과 루트 규칙 보강
status: done
priority: P2
area: [server, web, mobile]
created: 2026-11-04
updated: 2026-11-04
---

# 앱별 CLAUDE.md 작성과 루트 규칙 보강

## 현재 상태

완료. 앱별 CLAUDE.md 3개와 루트 규칙 보강을 마쳤다. 후속 과제 5건은 별도 이슈로 등록했다.
`.claude/agents/`는 보류했다. 필요해지면 새 이슈로 다시 시작한다.

## 배경

루트 `CLAUDE.md`에는 모노레포 공통 규칙만 있다. 앱마다 코드만 읽어서는 알 수 없는 규칙이 있는데
(엔티티 위치에 따라 마이그레이션 CLI가 엔티티를 못 찾는 문제, queryOptions가 ApiClient를 인자로 받는 이유 등),
이게 문서에 없으면 Agent와 사람이 같은 실수를 반복한다.

## 완료 조건

- [x] `apps/server-api/CLAUDE.md`, `apps/client-web/CLAUDE.md`, `apps/client-mobile/CLAUDE.md` 작성
- [x] 문서에 적은 경로·이름·명령이 실제 코드와 일치함을 확인
- [x] 루트 `CLAUDE.md`에 "하위 Agent 결과 기록" 규칙과 "spec 파일 mock 예외" 규칙 추가
- [x] 루트와 앱별 문서 사이에 같은 규칙이 중복되지 않음
- [x] 작업 중 발견한 후속 과제를 별도 이슈로 등록
- [x] `pnpm format:check` 통과

## 범위 밖

- `.claude/agents/` 커스텀 Agent 정의 (보류하기로 함)
- 후속 이슈의 실제 구현

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: `apps/server-api/CLAUDE.md`, `apps/client-web/CLAUDE.md`, `apps/client-mobile/CLAUDE.md` 작성.
  루트 `CLAUDE.md`에 규칙 9(하위 Agent 결과는 메인 세션이 기록), spec mock 예외, 앱별 문서 안내 추가.
  spec mock 예외는 처음에 server 문서에도 썼다가 루트와 중복이라 server 문서에서 삭제함.
  web 문서의 "app/은 데이터 조회를 하지 않는다"는 `app/health/page.tsx`가 SSR prefetch를 해서 틀린 서술이었음 → 정정.
  후속 이슈 5건 등록: domain-scaffold-generator, add-web-test-runner, session-start-toolchain-hook,
  typed-test-mocks, remove-cast-in-exception-filter
- 검증: `pnpm format:check` → 통과 / 문서가 참조하는 이슈 파일·소스 경로 존재 확인 스크립트 → 누락 0건 /
  이슈 `id`와 파일명 일치 → 불일치 0건
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성 및 착수. 초안을 코드와 대조하는 과정에서 아래 사항을 확인함
  - server: `forbidNonWhitelisted: true`라서 미선언 필드는 "제거"가 아니라 400 거부 (초안 오류 정정)
  - server: `data-source.ts`는 `modules/**/entities/*.entity.*` 경로만 찾음. 런타임(autoLoadEntities)과 기준이 다름
  - server: spec 3개 파일에 `as unknown as` 6건 존재. 루트 금지 규칙과 충돌
  - server: Repository / BaseEntity / DTO를 실제로 쓰는 참고 구현이 0건
  - web: `test` 스크립트 없음. 테스트 규칙은 지금 지킬 수 없음
  - 컨테이너에 `flutter`, `kustomize`, `kubeconform` 미설치
- 검증: 위 사항은 `grep`, `find`, `which`로 확인함
- 다음: 문서 작성 후 검증
