---
id: 2026-11-04-domain-scaffold-generator
title: 도메인 모듈 생성기 템플릿 (계층 구조의 참고 구현)
status: done
priority: P2
area: [server, web, mobile, shared]
created: 2026-11-04
updated: 2026-11-05
---

# 도메인 모듈 생성기 템플릿

## 현재 상태

완료. `pnpm scaffold <name>` 으로 네 곳(server·web·mobile·shared-types)에 같은 구조를 만든다.
`pnpm scaffold:verify` 가 임시 도메인을 생성해 전체 검증을 돌린 뒤 되돌린다. 이 검증을 CI 에서 돌리는 작업은
저장소에 CI 가 없어 별도 이슈(`2026-11-05-add-ci-pipeline`)로 분리했다.

## 배경

`apps/server-api/CLAUDE.md`는 Controller → Service → Repository → Entity 구조를 규칙으로 정했지만,
저장소에는 이 구조를 따르는 코드가 하나도 없다 (`health` 모듈은 저장소 계층이 없는 예외).
따라 할 예시가 없으면 Agent와 사람이 매번 다른 방식으로 도메인을 만들고, 도메인이 쌓일수록 패턴이 섞인다.

같은 입력에 같은 결과가 나와야 하는 작업이라 LLM Agent보다 템플릿 생성기가 맞다.
그래서 `.claude/agents/domain-scaffolder` 대신 생성기를 먼저 만들기로 했다.
템플릿에는 뼈대만 있어서, 보일러플레이트에 도메인 로직을 넣지 않는다는 원칙과도 충돌하지 않는다.

## 완료 조건

- [x] 명령 하나로 `<name>`을 입력하면 server(module/controller/service/repository/dto/entities), web(features/<name>/api, components), mobile(features/<name>/{domain,data,presentation}), shared-types 스키마가 생성됨
- [x] 생성된 엔티티가 `modules/<name>/entities/`에 있고 `BaseEntity`를 상속함
- [x] 임시 도메인을 생성 → lint·typecheck·test·format·`flutter analyze`·`flutter test` 통과 → 되돌리기 (`pnpm scaffold:verify`).
      **CI 에서 자동 실행하는 것은 `2026-11-05-add-ci-pipeline` 으로 분리** (저장소에 CI 가 없어 이 이슈의 범위를 넘는다)
- [x] `apps/server-api/CLAUDE.md`의 "참고 구현이 없다" 문장을 생성기 사용법으로 교체

## 범위 밖

- 생성기를 감싸는 커스텀 Agent (필요해지면 별도 이슈)
- 실제 도메인 추가

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경:
  - `scripts/scaffold-domain.mjs`: 의존성 없는 Node 스크립트. kebab 이름을 받아 Pascal·camel·snake·복수형으로 변환하고
    `scripts/templates/domain/` 의 템플릿을 렌더링한다. `--plural`(불규칙 복수형), `--dry-run`, `--force` 지원.
    `AppModule` 과 shared-types `index.ts` 등록까지 하고, 이미 있는 줄은 다시 넣지 않는다
  - 템플릿 13개: shared-types 계약(Zod), server(entity·dto·repository·service·controller·module·service.spec),
    web(api·queries), mobile(domain·data·presentation 컨트롤러·화면)
  - `scripts/verify-scaffold.sh`: 임시 도메인 `scaffoldprobe` 생성 → shared-types 빌드 →
    lint·typecheck·test → format:check → flutter analyze·test → **되돌리기**(trap 으로 실패해도 실행).
    되돌릴 경로에 사용자 변경이 있으면 시작하지 않는다
  - 루트 `package.json`: `scaffold`, `scaffold:verify` 스크립트
  - 루트·server-api `CLAUDE.md`: 생성기 사용법과 "공통 코드를 바꾸면 템플릿도 고치고 검증하라" 규칙
- 검증: 작성 과정에서 `verify-scaffold.sh` 가 템플릿 결함 5건을 실제로 잡아냈다. 이게 이 스크립트를 만든 이유다
  1. 자리표시자 정규식 `__(\w+)__` 가 `__snake___repository.dart` 에서 키를 `snake_` 로 잡음 → 키를 영문·숫자로 제한
  2. `app.module.ts` 등록 기준을 `imports: [` 로 둬서 import 문이 배열 안에 삽입됨 → 파일이 깨짐.
     기준을 마지막 import 문으로 변경
  3. 템플릿이 `pageInfo` 를 `{limit, total}` 로 만들었으나 실제 계약은 `{size, totalItems}` → 계약에 맞춤
  4. spec 템플릿의 불필요한 `as` → lint 실패 → 제거
  5. mobile 도메인 템플릿의 미사용 import → `flutter analyze` 실패 → 제거
  - 최종: `bash scripts/verify-scaffold.sh` → lint·typecheck·test 10/10, format:check 통과,
    flutter analyze·test 통과, "✔ 템플릿 검증 통과". 실행 후 `git status --porcelain` 에 생성물 없음
  - 이름 검증: `OrderItem` 이 조용히 `orderitem` 으로 통과하던 버그 수정 (소문자 변환 후 검사하던 것을 원본 검사로)
  - 복수형: order→orders, category→categories, box→boxes, order-item→order-items, `--plural person/people` 동작 확인.
    `quiz→quizes` 처럼 불규칙은 맞지 않으므로 `--plural` 로 지정한다 (출력에 복수형이 표시돼 바로 확인 가능)
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 참고 구현 부재를 확인하고, domain-scaffolder Agent 대신 생성기로 방향을 정함
- 검증: `grep -rn "Repository<\|@InjectRepository" apps/server-api/src` → 주석 1건 외 사용 0건
- 다음: 생성기 도구 선택
