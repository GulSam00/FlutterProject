---
id: 2026-11-05-add-ci-pipeline
title: CI 파이프라인 구축 (검증 명령과 템플릿 검증 자동 실행)
status: todo
priority: P2
area: [infra]
created: 2026-11-05
updated: 2026-11-05
---

# CI 파이프라인 구축

## 현재 상태

착수 전. 이 저장소에는 CI 설정이 없다 (`.github/` 디렉터리 자체가 없다).

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

- [ ] PR 과 기본 브랜치 push 에서 위 검증이 실행됨
- [ ] 도구 설치는 `scripts/setup-toolchain.sh` 를 재사용 (버전·체크섬이 로컬과 같아야 한다)
- [ ] Flutter 설치는 모바일 파일이 바뀐 경우에만 (전체 실행 시간 절약)
- [ ] 이슈 절차 검사 스크립트 추가 (`scripts/validate-issues.sh` 등)
- [ ] 일부러 규칙을 위반한 커밋으로 각 검사가 실패하는 것을 확인

## 범위 밖

- 배포 자동화 (이미지 빌드·푸시, K8s 적용)
- 커밋 메시지 형식 검사

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. `2026-11-04-domain-scaffold-generator` 의 완료 조건에 "CI 에서 템플릿 검증" 이 있었지만,
  저장소에 CI 자체가 없어 그 이슈의 범위를 넘었다. 생성기 쪽은 `scripts/verify-scaffold.sh` 로 명령을 만들어 두었고,
  이를 실행할 CI 를 여기서 다룬다 (규칙 8)
- 검증: `ls .github` → 디렉터리 없음
- 다음: CI 제공자 확인 (GitHub Actions 전제). 러너에서 도구 설치 경로가 열려 있는지 확인 필요
