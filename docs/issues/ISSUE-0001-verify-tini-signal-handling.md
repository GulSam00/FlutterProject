---
id: ISSUE-0001
title: 실제 Docker 이미지에서 tini 종료 신호 전달 검증
status: todo
priority: P1
area: [infra]
created: 2026-11-04
updated: 2026-11-04
---

# ISSUE-0001: 실제 Docker 이미지에서 tini 종료 신호 전달 검증

## 배경

`infra/docker/Dockerfile.server`, `Dockerfile.web`은 `tini`를 PID 1로 두어 SIGTERM을 Node 프로세스에
전달하게 되어 있다. 하지만 최초 구축 때 작업 환경이 Alpine 패키지 저장소를 막아서,
`apk add tini libc6-compat` 줄을 뺀 임시 사본으로만 빌드했다. 그래서 커밋된 Dockerfile 그대로는
빌드도, 종료 신호 전달도 확인하지 못했다.

신호가 전달되지 않으면 `docker stop`이나 K8s 롤링 업데이트 때 Node가 SIGTERM을 받지 못한다.
그러면 `terminationGracePeriodSeconds`가 끝날 때 SIGKILL로 죽고, 처리 중이던 요청과 DB 연결이 끊긴다.

## 완료 조건

- [ ] 커밋된 Dockerfile 그대로 `pnpm docker:up`으로 두 이미지 빌드 성공
- [ ] `docker compose ... stop server-api` 후 로그에 Nest shutdown hook 실행 흔적이 있고, 종료 코드가 137(SIGKILL)이 아님
- [ ] client-web도 같은 방식으로 종료 코드 확인
- [ ] 컨테이너 안 `ps`에서 PID 1이 tini, 앱 프로세스 사용자가 `node`

## 범위 밖

- K8s 환경에서의 preStop/grace period 튜닝

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 최초 구축(커밋 `078f28f`) 때 환경 제약으로 검증하지 못한 항목을 옮겨 적음
- 검증: 없음 (등록만 함)
- 다음: Alpine 저장소와 Docker Hub에 접근 가능한 환경에서 완료 조건 실행
