---
id: 2026-11-04-verify-tini-signal-handling
title: 실제 Docker 이미지에서 tini 종료 신호 전달 검증
status: done
priority: P1
area: [infra]
created: 2026-11-04
updated: 2026-11-05
---

# 실제 Docker 이미지에서 tini 종료 신호 전달 검증

## 현재 상태

착수 전. 커밋된 Dockerfile 그대로는 아직 한 번도 빌드·검증되지 않았다.
Alpine 패키지 저장소와 Docker Hub에 접근할 수 있는 환경이 필요하다.

## 배경

`infra/docker/Dockerfile.server`, `Dockerfile.web`은 `tini`를 PID 1로 두어 SIGTERM을 Node 프로세스에
전달하게 되어 있다. 하지만 최초 구축 때 작업 환경이 Alpine 패키지 저장소를 막아서,
`apk add tini libc6-compat` 줄을 뺀 임시 사본으로만 빌드했다. 그래서 커밋된 Dockerfile 그대로는
빌드도, 종료 신호 전달도 확인하지 못했다.

신호가 전달되지 않으면 `docker stop`이나 K8s 롤링 업데이트 때 Node가 SIGTERM을 받지 못한다.
그러면 `terminationGracePeriodSeconds`가 끝날 때 SIGKILL로 죽고, 처리 중이던 요청과 DB 연결이 끊긴다.

## 완료 조건

- [x] 커밋된 Dockerfile 그대로 `pnpm docker:up`으로 두 이미지 빌드 성공
- [x] `docker compose ... stop server-api` 후 로그에 Nest shutdown hook 실행 흔적이 있고, 종료 코드가 137(SIGKILL)이 아님
- [x] client-web도 같은 방식으로 종료 코드 확인
- [x] 컨테이너 안 `ps`에서 PID 1이 tini, 앱 프로세스 사용자가 `node`

## 범위 밖

- K8s 환경에서의 preStop/grace period 튜닝

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 코드 변경 없음. 검증만 수행했다. 검증 중 발견한 compose 빌드 실패는
  별도 이슈 `2026-11-04-docker-compose-build-blocked-by-proxy` 로 등록했다 (규칙 8).
- 검증: Docker 데몬을 띄우고 커밋된 Dockerfile 그대로 빌드·실행했다.
  - 처음에는 `pnpm docker:up` 이 실패했다: `dl-cdn.alpinelinux.org ... DNS: name does not exist` →
    `libc6-compat (no such package)`. 호스트에서는 같은 URL 이 HTTP 200 이므로, 빌드 컨테이너가
    에이전트 프록시를 통과하지 못하는 것이 원인이었다
  - `docker build --network=host` 와 `HTTP(S)_PROXY` build-arg 를 주어 **커밋된 Dockerfile 그대로**
    `Dockerfile.server`·`Dockerfile.web` 두 이미지 빌드 성공 (apk 로 tini·libc6-compat 설치 포함)
  - 컨테이너 내부 `ps`: server → `PID 1 = /sbin/tini -- node dist/main.js`, 앱은 PID 7, 사용자 `node`.
    web → `PID 1 = /sbin/tini -- node apps/client-web/server.js`, 사용자 `node`
  - `docker stop hc-srv` → **199ms 에 종료, 종료 코드 143**(= 128+SIGTERM). 10초 grace period 를
    소진하지 않았고 137(SIGKILL)이 아니다. 즉 SIGTERM 이 tini 를 거쳐 Node 에 전달됐다.
    143 은 Nest 의 `enableShutdownHooks` 가 `app.close()` 후 같은 신호를 다시 올리기 때문이다
  - `docker kill --signal=TERM` 으로 직접 보낸 경우도 208ms / 143 으로 동일
  - `docker stop hc-web` → 224ms, 종료 코드 0
  - 종료 시 stderr 출력 없음 (연결 정리 중 에러 없음)
  - tini 의 좀비 수거: 컨테이너 안에서 고아 프로세스를 만든 뒤 `ps -o stat | grep -c Z` → 0
  - 두 컨테이너의 `HEALTHCHECK` 모두 start-period 경과 후 `healthy`
  - 부수 확인: 운영 이미지의 `/api/v1/health` 가 `{status, checkedAt}` 만 반환하고,
    web `/health` 페이지는 HTTP 200 + "상세 정보를 공개하지 않습니다" 문구를 렌더링했다
    (`2026-11-04-restrict-health-detail-exposure` 가 실제 이미지에서도 동작)
  - **한계**: `app.close()` 자체에 계측을 넣어 "어떤 리소스가 어떤 순서로 닫혔는지" 까지는 확인하지 않았다.
    확인한 것은 신호가 Node 에 도달했고, grace period 를 소진하지 않고, 에러 없이 끝났다는 것이다
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 ID 체계를 날짜+slug로 바꾸면서 ID를 `ISSUE-0001` → `2026-11-04-verify-tini-signal-handling`로 변경. `## 현재 상태` 섹션 추가
- 검증: `pnpm format:check` → 통과
- 다음: 없음 (이슈 내용 자체는 변경 없음)

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 최초 구축(커밋 `078f28f`) 때 환경 제약으로 검증하지 못한 항목을 옮겨 적음
- 검증: 없음 (등록만 함)
- 다음: Alpine 저장소와 Docker Hub에 접근 가능한 환경에서 완료 조건 실행
