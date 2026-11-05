#!/usr/bin/env bash
# 로컬 스택 기동. 이미지 빌드와 컨테이너 시작을 나눠서 한다.
#
# 사용법: bash scripts/docker-up.sh [compose 에 넘길 추가 인자...]
#   예) bash scripts/docker-up.sh postgres redis      # 일부 서비스만
#
# 왜 `docker compose up --build` 가 아닌가 (docs/issues/2026-11-04-docker-compose-build-blocked-by-proxy.md)
#   빌드 컨테이너는 호스트의 DNS·프록시를 물려받지 않는다. 사내 프록시나 클라우드 세션처럼
#   아웃바운드가 프록시를 거치는 환경에서는 Dockerfile 의 `apk add` 가 DNS 실패로 멈춘다.
#   프록시가 루프백 주소(127.0.0.1:xxxx)에만 바인딩되어 있으면 빌드가 호스트 네트워크를 써야 그 주소에 닿는다.
#   그런데 `docker compose build` 는 내부적으로 buildx bake 를 쓰고, bake 가 요구하는
#   `--allow=network.host` 권한 플래그를 compose 가 넘겨주지 못한다
#   ("additional privileges requested: pass --allow=network.host").
#   그래서 호스트 네트워크가 필요할 때만 bake 를 직접 호출하고, compose 는 시작만 담당한다.
#
# 프록시가 없는 환경에서는 기존과 동일하게 compose 가 빌드한다 (bake 경로를 타지 않는다).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.local.yml"
readonly ENV_FILE="$REPO_ROOT/infra/docker/.env"

log() { printf '[docker-up] %s\n' "$*" >&2; }
die() {
  printf '[docker-up] ✖ %s\n' "$*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE 이 없습니다 → cp infra/docker/.env.example infra/docker/.env"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

if [[ "${DOCKER_BUILD_NETWORK:-default}" == "host" ]]; then
  log "호스트 네트워크로 빌드 (프록시 환경). bake 를 직접 호출한다"
  # bake 는 --env-file 을 받지 않는다. compose 파일의 ${VAR} 치환을 위해 직접 읽어 내보낸다.
  set -a
  # shellcheck disable=SC1090 # 경로가 런타임에 결정된다
  . "$ENV_FILE"
  set +a

  # bake 는 compose 의 `context: ../..` 를 **현재 디렉터리** 기준으로 푼다 (compose 파일 위치 기준이 아니다).
  # 저장소 루트에서 실행하면 컨텍스트가 상위 디렉터리(/home 등)로 잡혀 권한 요구 범위가 불필요하게 넓어진다.
  # compose 파일이 있는 디렉터리에서 실행하면 `../..` 가 의도대로 저장소 루트가 된다.
  #
  # fs.read: 빌드 컨텍스트(저장소 루트) 읽기 권한. network.host: 위 주석 참조.
  # 둘 다 이 빌드가 실제로 필요한 범위로만 준다.
  (
    cd "$(dirname "$COMPOSE_FILE")"
    docker buildx bake \
      -f "$(basename "$COMPOSE_FILE")" \
      --allow=network.host \
      --allow="fs.read=$REPO_ROOT" \
      server-api client-web
  ) || die "bake 빌드 실패"
else
  log "compose 로 빌드"
  compose build || die "compose 빌드 실패"
fi

log "컨테이너 시작"
compose up -d --no-build "$@"

log "✔ 기동 완료. 상태 확인: pnpm docker:logs 또는 docker compose ps"
