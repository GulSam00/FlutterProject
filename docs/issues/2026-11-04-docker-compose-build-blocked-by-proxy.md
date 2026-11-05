---
id: 2026-11-04-docker-compose-build-blocked-by-proxy
title: 프록시 환경에서 pnpm docker:up 의 이미지 빌드가 실패한다
status: blocked
priority: P2
area: [infra]
created: 2026-11-05
updated: 2026-11-05
---

# 프록시 환경에서 pnpm docker:up 의 이미지 빌드가 실패한다

## 현재 상태

compose·스크립트·문서 작업은 끝났다. 이 방식으로 **두 이미지가 실제로 빌드되는 것을 확인했다**(이 세션 중).

**막혀 있음**: 전체 스택(5개 서비스 healthy) 검증은 지금 환경에서 완료할 수 없다.
도중에 컨테이너의 외부 egress 가 막혔다. 호스트에서 `registry.npmjs.org` 는 200 인데,
컨테이너(호스트 네트워크 포함)에서는 `Connection reset by peer` 다. 그래서 빌더의 `pnpm install` 이 끝나지 않는다.
저장소 설정 문제가 아니라 이 샌드박스의 네트워크 조건이다. 컨테이너 egress 가 열린 환경에서 재확인이 필요하다.

## 배경

아웃바운드 HTTPS 가 프록시를 거치는 환경(이 저장소의 클라우드 세션이 그렇다)에서 `pnpm docker:up` 이 실패한다.

```
dl-cdn.alpinelinux.org ... DNS: name does not exist
ERROR: unable to select packages: libc6-compat (no such package)
```

호스트에서 같은 URL 은 HTTP 200 이다. 빌드 컨테이너가 호스트의 DNS·프록시 설정을 물려받지 못해서 생기는 문제다.
`docker build --network=host` 와 `HTTP(S)_PROXY` build-arg 를 주면 **Dockerfile 을 그대로 두고도** 빌드된다.
compose 가 그 옵션을 주지 않는 것이 유일한 차이다.

이 상태로는 프록시 환경에서 로컬 스택을 띄울 수 없고, README Step 2·3 의 검증을 그대로 따라갈 수 없다.

## 완료 조건

- [x] 프록시 환경에서 `pnpm docker:up` 을 성공시키는 방법이 README 와 compose 주석에 있음
      (`DOCKER_BUILD_NETWORK=host` + 프록시 build args. Dockerfile 은 고치지 않는다)
- [x] 방식 결정을 변경 로그에 기록 (compose 가 bake 의 `--allow` 를 넘기지 못하는 문제와 그 해법)
- [x] 프록시가 없는 환경에서 동작이 달라지지 않음: `docker compose config` 로 확인 →
      `network: default`, 프록시 args 는 빈 문자열. 빈 값의 미리 정의된 프록시 build arg 는 무효과다
- [ ] 두 이미지 빌드 후 5개 서비스가 모두 healthy 인지 확인 — **환경 제약으로 미검증** (위 "현재 상태" 참조)

## 범위 밖

- Dockerfile 에서 `apk` 의존성(tini, libc6-compat) 제거. tini 는 종료 신호 전달에 필요하다

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경:
  - `docker-compose.local.yml`: 두 서비스의 `build` 에 `network: ${DOCKER_BUILD_NETWORK:-default}` 와
    `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` build args 추가. 이 세 변수는 Docker 가 미리 정의한 빌드 인자라
    Dockerfile 에 `ARG` 선언이 필요 없고 최종 이미지에도 남지 않는다 (프록시 주소가 이미지에 박히지 않는다)
  - `scripts/docker-up.sh`(신규) + `pnpm docker:up` 이 이를 호출: 호스트 네트워크가 필요할 때만 bake 를 직접 부르고,
    compose 는 시작만 담당한다. `docker compose build` 는 내부적으로 bake 를 쓰면서
    bake 가 요구하는 `--allow=network.host` 를 넘겨주지 못한다
  - bake 는 compose 의 `context: ../..` 를 **현재 디렉터리** 기준으로 푼다. 저장소 루트에서 실행하면
    컨텍스트가 `/home` 으로 잡혀 권한 요구 범위가 넓어진다 → 스크립트가 compose 파일 디렉터리에서 실행한다
  - README·compose 헤더·`.env.example` 에 프록시 환경 사용법
- 검증:
  - `docker buildx bake --allow=network.host --allow=fs.read=<repo>` 로 **server-api·client-web 두 이미지 빌드 성공**
    (커밋된 Dockerfile 그대로, apk 로 tini·libc6-compat 설치 포함)
  - `docker compose config` → 프록시 값이 없을 때 `network: default` + 빈 args. 기존 동작과 동일
  - `pnpm docker:up` 전체 실행은 **실패**: 빌더의 `pnpm install` 이 646개 해석 후 진행되지 않는다.
    원인을 좁힌 결과 컨테이너 egress 차단이었다 —
    호스트 `curl https://registry.npmjs.org/zod` → 200,
    `docker run --network host node:22-alpine wget https://registry.npmjs.org/zod` → `Connection reset by peer`.
    `NO_PROXY` 에 `registry.npmjs.org` 가 있어 프록시를 우회하는데, 컨테이너는 직접 나갈 수 없다.
    세션 초반에는 같은 설정으로 빌드가 끝났으므로 저장소 설정 문제가 아니다
  - 병렬 빌드가 원인인지 확인하려고 순차 빌드로도 돌려봤으나 같은 지점에서 멈췄다 (병렬 문제가 아니다)
- 다음: 컨테이너 egress 가 열린 환경에서 `pnpm docker:up` → 5개 서비스 healthy 확인.
  그 환경에서도 레지스트리가 프록시 우회로 지정돼 있으면, 빌드용 `NO_PROXY` 에서 레지스트리를 빼는 방안을 검토한다

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성
- 검증: `pnpm docker:up` → 위 apk 오류로 실패.
  `curl -I https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/APKINDEX.tar.gz` (호스트) → 200.
  `docker build --network=host --build-arg HTTP_PROXY=$HTTPS_PROXY --build-arg HTTPS_PROXY=$HTTPS_PROXY ...` →
  `Dockerfile.server`·`Dockerfile.web` 둘 다 빌드 성공
- 다음: 방식 결정
