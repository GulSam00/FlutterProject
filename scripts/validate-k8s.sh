#!/usr/bin/env bash
# K8s 매니페스트 검증: kustomize로 overlay를 렌더링하고 kubeconform으로 스키마를 검사한다.
#
# 사용법: bash scripts/validate-k8s.sh [overlay...]     (기본: dev prod)
#   예)   bash scripts/validate-k8s.sh dev
#
# 이 스크립트가 막는 문제 (docs/issues/2026-11-04-k8s-validation-false-pass.md)
#   `kustomize build ... | kubeconform ...` 파이프는 새 clone에서 거짓 통과한다.
#     1. secrets.env(.gitignore 대상)가 없어 kustomize가 실패한다.
#     2. kubeconform은 빈 입력에 "0 resources, Valid: 0"을 출력하고 0으로 끝난다.
#     3. pipefail이 없으면 파이프 전체의 종료 코드는 kubeconform의 0이다.
#   그래서 이 스크립트는 단계를 파이프로 잇지 않고 하나씩 실행해서, 어느 단계든 실패하면 즉시 0이 아닌 코드로 끝낸다.
#   렌더링된 리소스가 0개인 경우도 실패로 본다.
#
# 비밀 파일 처리
#   secrets.env가 없으면 secrets.env.example을 "임시 복사본"에만 넣어 렌더링한다.
#   작업 트리에는 아무 파일도 만들지 않는다 (example 값이 진짜 비밀처럼 남는 사고 방지).
#   렌더링 결과는 임시 디렉터리에만 두고, 끝나면 지운다 (진짜 secrets.env의 값이 디스크에 남지 않게).
#
# 환경변수
#   K8S_DIR              검증할 k8s 디렉터리 (기본: <repo>/infra/k8s). 테스트용으로 깨진 사본을 지정할 때 쓴다.
#   KUBERNETES_VERSION   스키마 기준 버전 (기본: 1.33.0)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly K8S_DIR="${K8S_DIR:-$REPO_ROOT/infra/k8s}"
readonly KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.33.0}"

log() { printf '[validate-k8s] %s\n' "$*" >&2; }
die() {
  printf '[validate-k8s] ✖ %s\n' "$*" >&2
  exit 1
}

TMP_DIR=""
cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

require_tools() {
  local missing=()
  local tool
  for tool in kustomize kubeconform; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "필요한 도구가 없습니다: ${missing[*]} → 'bash scripts/setup-toolchain.sh' 실행 후 다시 시도하세요.
  설치할 수 없으면 이 검증은 '검증 미실행: ${missing[*]} 없음'으로 기록합니다."
  fi
}

# 렌더링된 YAML에서 리소스 개수를 센다 (문서마다 최상위 `kind:` 줄이 하나씩 있다)
count_resources() {
  local file="$1" count
  count="$(grep -c '^kind:' "$file" || true)"
  echo "${count:-0}"
}

validate_overlay() {
  local overlay="$1"
  local src_overlay="$K8S_DIR/overlays/$overlay"
  [[ -d "$src_overlay" ]] || die "overlay가 없습니다: $src_overlay"

  # overlay는 ../../base를 참조하므로 k8s 디렉터리 전체를 복사한다
  local work="$TMP_DIR/$overlay"
  mkdir -p "$work"
  cp -R "$K8S_DIR/." "$work/"
  local overlay_dir="$work/overlays/$overlay"

  if [[ ! -f "$overlay_dir/secrets.env" && -f "$overlay_dir/secrets.env.example" ]]; then
    cp "$overlay_dir/secrets.env.example" "$overlay_dir/secrets.env"
    log "$overlay: secrets.env 없음 → 임시 복사본에 secrets.env.example 사용"
  fi

  local rendered="$work/rendered.yaml"
  log "$overlay: kustomize build"
  kustomize build "$overlay_dir" >"$rendered" || die "$overlay: kustomize build 실패"

  local count
  count="$(count_resources "$rendered")"
  if [[ "$count" -eq 0 ]]; then
    die "$overlay: 렌더링된 리소스가 0개입니다. 검증할 대상이 없으므로 실패로 처리합니다."
  fi

  log "$overlay: kubeconform (리소스 ${count}개, Kubernetes $KUBERNETES_VERSION)"
  kubeconform -strict -summary -kubernetes-version "$KUBERNETES_VERSION" "$rendered" ||
    die "$overlay: kubeconform 검증 실패"
}

main() {
  require_tools
  local overlays=("$@")
  if [[ ${#overlays[@]} -eq 0 ]]; then
    overlays=(dev prod)
  fi

  TMP_DIR="$(mktemp -d)"
  local overlay
  for overlay in "${overlays[@]}"; do
    validate_overlay "$overlay"
  done
  log "✔ 통과: ${overlays[*]}"
}

main "$@"
