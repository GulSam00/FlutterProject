---
id: 2026-11-04-docker-compose-build-blocked-by-proxy
title: 프록시 환경에서 pnpm docker:up 의 이미지 빌드가 실패한다
status: todo
priority: P2
area: [infra]
created: 2026-11-05
updated: 2026-11-05
---

# 프록시 환경에서 pnpm docker:up 의 이미지 빌드가 실패한다

## 현재 상태

착수 전. 원인과 우회 방법은 확인했다 (`2026-11-04-verify-tini-signal-handling` 검증 중 발견).

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

- [ ] 프록시 환경에서 `pnpm docker:up` 이 그대로 성공하거나, 성공시키는 방법이 README 에 있음
- [ ] 방식 결정을 변경 로그에 기록. 후보: compose 의 `build.network: host` + `build.args`,
      `~/.docker/config.json` 의 `proxies` 설정 안내, 또는 프록시 환경 전용 compose override 파일
- [ ] 프록시가 없는 환경에서도 기존과 동일하게 동작함을 확인 (프록시 값이 비어 있을 때 빌드가 깨지지 않아야 한다)
- [ ] 두 이미지 빌드 후 5개 서비스가 모두 healthy 가 되는지 확인

## 범위 밖

- Dockerfile 에서 `apk` 의존성(tini, libc6-compat) 제거. tini 는 종료 신호 전달에 필요하다

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성
- 검증: `pnpm docker:up` → 위 apk 오류로 실패.
  `curl -I https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/APKINDEX.tar.gz` (호스트) → 200.
  `docker build --network=host --build-arg HTTP_PROXY=$HTTPS_PROXY --build-arg HTTPS_PROXY=$HTTPS_PROXY ...` →
  `Dockerfile.server`·`Dockerfile.web` 둘 다 빌드 성공
- 다음: 방식 결정
