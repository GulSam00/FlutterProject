---
id: 2026-11-05-add-ci-pipeline
title: CI 파이프라인 구축 (검증 명령과 템플릿 검증 자동 실행)
status: done
priority: P2
area: [infra]
created: 2026-11-05
updated: 2026-11-05
---

# CI 파이프라인 구축

## 현재 상태

완료. GitHub Actions 에서 run #4 가 `success` 로 끝났다 (run id 41976631174).
모든 브랜치 push 에서 돌고, 변경 영역에 따라 모바일·인프라·계약 job 을 건너뛴다.
실제 실행으로 결함 2건(생성기 job 의 의존성 누락, 환경변수 없는 웹 빌드 실패)을 찾아 고쳤다.

## 배경

루트 `CLAUDE.md` 의 규칙은 전부 권고 수준이다. 사람이 IDE 에서 바로 커밋하거나 Agent 가 절차를 놓치면
아무것도 막지 못한다. 기계로 검사할 수 있는 항목이 여러 개 쌓여 있다.

- 검증 명령: `pnpm lint`, `typecheck`, `test`, `format:check`, `pnpm mobile:analyze`, `mobile:test`
- `bash scripts/validate-k8s.sh` (매니페스트 스키마)
- `pnpm scaffold:verify` (생성기 템플릿이 공통 코드 변경으로 낡지 않았는지)
- 이슈 절차 검사: 이슈 파일의 `id` 와 파일명 일치, `status: done` 인데 체크 안 된 완료 조건이 남아 있지 않은지,
  변경 로그에서 기존 줄이 삭제되지 않았는지

마지막 항목이 특히 중요하다. 지금은 "검증했다" 는 기록을 믿을 수밖에 없고,
이 저장소가 계속 막아 온 문제(실패한 검증을 통과로 기록)를 사람이 눈으로만 걸러야 한다.

## 완료 조건

- [x] PR 과 기본 브랜치 push 에서 위 검증이 실행됨
- [x] 도구 설치는 `scripts/setup-toolchain.sh` 를 재사용 (버전·체크섬이 로컬과 같아야 한다)
- [x] Flutter 설치는 모바일 파일이 바뀐 경우에만 (전체 실행 시간 절약)
- [x] 이슈 절차 검사 스크립트 추가 (`scripts/validate-issues.sh` 등)
- [x] 일부러 규칙을 위반한 커밋으로 각 검사가 실패하는 것을 확인
- [x] GitHub Actions 에서 실제 실행 결과 확인 (워크플로 문법·job 조건이 의도대로 동작하는지)

## 범위 밖

- 배포 자동화 (이미지 빌드·푸시, K8s 적용)
- 커밋 메시지 형식 검사

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 트리거를 모든 브랜치 push 로 바꾸고(원래는 `main` push·PR 만이라 한 번도 실행되지 않았다),
  중복 실행 판단과 변경 영역 판단을 `plan` job 하나로 모았다. CI 가 찾은 결함 2건을 함께 고쳤다.
- 검증 (GitHub Actions 실제 실행):
  - run #1: `plan` 성공, `이슈 절차` 성공, `Flutter`·`K8s`·`계약 드리프트` **skipped**
    → 워크플로 파일만 바꾼 커밋이라 경로 필터가 의도대로 동작함을 확인
  - run #1 `생성기 템플릿` **실패**: `verify-scaffold.sh` 를 의존성 설치 없이 돌려 shared-types 빌드가 깨졌다
    → job 에 `pnpm install --frozen-lockfile` 추가
  - run #2 `verify`·`생성기 템플릿` **실패**: `@app/client-web#build` 가
    `Invalid input: expected string, received undefined` → `Failed to collect page data for /health`.
    로컬은 gitignore 된 `.env.local` 때문에 통과하고 있었고, 새 clone 은 같은 벽에 막힌다
    → 빌드하는 job 에 `NEXT_PUBLIC_API_URL`·`API_INTERNAL_URL` 자리표시자 추가,
      `env.ts` 의 에러 메시지에 해결 방법 명시, README Step 1 에 예시 env 복사 추가
  - run #4 **success** (전체 2분 14초). 이 커밋은 `apps/client-web/src/lib/env.ts` 를 바꿨으므로
    계약·모바일·K8s job 은 정확히 skipped
  - 로컬: `bash scripts/validate-issues.sh` → 이슈 12개 통과. 위반 3종(체크 안 된 완료 조건, id 불일치,
    잘못된 status) 각각 exit 1 확인
  - `concurrency` 동작 확인: 새 push 때 진행 중이던 run #1 이 `cancelled` 로 바뀜
- 다음: 없음

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: `.github/workflows/ci.yml`(신규), `scripts/validate-issues.sh`(신규)
  - 워크플로 설계: CI 안에 로직을 두지 않고 `scripts/` 의 명령만 호출한다.
    "로컬은 통과하는데 CI 만 실패" 또는 그 반대를 막기 위한 것이다
  - job 7개: `changes`(변경 영역 판단) · `issues` · `verify`(lint·typecheck·test·format) ·
    `contracts` · `k8s` · `mobile` · `scaffold`.
    `contracts`·`k8s`·`mobile` 은 해당 파일이 바뀐 PR 에서만 돈다 (Flutter 설치가 수 분 걸린다)
  - `validate-issues.sh` 가 검사하는 것: 파일명 형식, `id`-파일명 일치, `status` 값,
    `done` 인데 체크 안 된 완료 조건, 필수 섹션, 변경 로그 항목 유무
  - 기계로 판정할 수 없는 "로그에 적힌 검증을 실제로 실행했는가" 는 CI 가 검증 명령을 **직접 다시 돌려서** 대신한다
- 검증:
  - `bash scripts/validate-issues.sh` → 이슈 12개 통과
  - 일부러 위반을 만들어 각각 exit 1 확인:
    ① `done` 인데 `- [ ]` 남김 → "체크되지 않은 완료 조건이 1건"
    ② `id` 를 파일명과 다르게 → "frontmatter id 가 파일 이름과 다릅니다"
    ③ `status: finished` → "status 값이 올바르지 않습니다". 복원 후 다시 통과
  - 워크플로 YAML 파싱 확인 (job 7개, needs/if 조건 포함)
  - **미검증**: GitHub Actions 에서의 실제 실행. push 후 결과를 확인해야 한다
- 다음: push 후 Actions 실행 결과 확인

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. `2026-11-04-domain-scaffold-generator` 의 완료 조건에 "CI 에서 템플릿 검증" 이 있었지만,
  저장소에 CI 자체가 없어 그 이슈의 범위를 넘었다. 생성기 쪽은 `scripts/verify-scaffold.sh` 로 명령을 만들어 두었고,
  이를 실행할 CI 를 여기서 다룬다 (규칙 8)
- 검증: `ls .github` → 디렉터리 없음
- 다음: CI 제공자 확인 (GitHub Actions 전제). 러너에서 도구 설치 경로가 열려 있는지 확인 필요
