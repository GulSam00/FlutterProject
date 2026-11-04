---
id: 2026-11-04-domain-scaffold-generator
title: 도메인 모듈 생성기 템플릿 (계층 구조의 참고 구현)
status: todo
priority: P2
area: [server, web, mobile, shared]
created: 2026-11-04
updated: 2026-11-04
---

# 도메인 모듈 생성기 템플릿

## 현재 상태

착수 전. 생성기 도구(plop / Nest schematics / 직접 작성한 스크립트)를 아직 정하지 않았다.

## 배경

`apps/server-api/CLAUDE.md`는 Controller → Service → Repository → Entity 구조를 규칙으로 정했지만,
저장소에는 이 구조를 따르는 코드가 하나도 없다 (`health` 모듈은 저장소 계층이 없는 예외).
따라 할 예시가 없으면 Agent와 사람이 매번 다른 방식으로 도메인을 만들고, 도메인이 쌓일수록 패턴이 섞인다.

같은 입력에 같은 결과가 나와야 하는 작업이라 LLM Agent보다 템플릿 생성기가 맞다.
그래서 `.claude/agents/domain-scaffolder` 대신 생성기를 먼저 만들기로 했다.
템플릿에는 뼈대만 있어서, 보일러플레이트에 도메인 로직을 넣지 않는다는 원칙과도 충돌하지 않는다.

## 완료 조건

- [ ] 명령 하나로 `<name>`을 입력하면 server(module/controller/service/repository/dto/entities), web(features/<name>/api, components), mobile(features/<name>/{domain,data,presentation}), shared-types 스키마가 생성됨
- [ ] 생성된 엔티티가 `modules/<name>/entities/`에 있고 `BaseEntity`를 상속함
- [ ] CI에서 임시 `sample` 도메인을 생성 → typecheck·test·`flutter analyze` 통과 → 삭제 (템플릿이 낡지 않게)
- [ ] `apps/server-api/CLAUDE.md`의 "참고 구현이 없다" 문장을 생성기 사용법으로 교체

## 범위 밖

- 생성기를 감싸는 커스텀 Agent (필요해지면 별도 이슈)
- 실제 도메인 추가

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 참고 구현 부재를 확인하고, domain-scaffolder Agent 대신 생성기로 방향을 정함
- 검증: `grep -rn "Repository<\|@InjectRepository" apps/server-api/src` → 주석 1건 외 사용 0건
- 다음: 생성기 도구 선택
