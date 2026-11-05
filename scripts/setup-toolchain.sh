#!/usr/bin/env bash
# 검증 도구 설치 스크립트 (Linux 전용)
#
# 용도
#   - 클라우드 세션: 환경 설정의 Setup script가 이 스크립트를 호출한다 (README "클라우드 세션 설정" 참조).
#     설치는 컨테이너를 만들 때 한 번만 일어나고, 세션 시작(SessionStart hook)은 확인만 한다.
#   - 직접 실행: `bash scripts/setup-toolchain.sh [--with-flutter]`
#
# 운영 리스크 예방 포인트
#   1. 버전 고정: 세션마다 다른 버전이 깔리면 같은 매니페스트가 어떤 날은 통과하고 어떤 날은 실패한다.
#   2. sha256 검증: 받은 바이너리를 그대로 실행하는 구조라, 변조된 파일이 들어오면 공급망 공격이 된다.
#      체크섬이 다르면 설치하지 않고 즉시 실패한다.
#   3. 멱등성: 이미 같은 버전이 있으면 건너뛴다. 여러 번 실행해도 결과가 같다.
#   4. 실패는 크게: 하나라도 실패하면 0이 아닌 코드로 끝난다. 반쯤 설치된 상태로 조용히 넘어가지 않는다.
#
# 버전 올리는 법
#   - 아래 *_VERSION과 *_SHA256을 같은 커밋에서 함께 바꾼다. 체크섬은 각 프로젝트의 공식 체크섬 파일에서 가져온다.
#     kustomize:   https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv<ver>/checksums.txt
#     kubeconform: https://github.com/yannh/kubeconform/releases/download/v<ver>/CHECKSUMS
#     flutter:     https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json
#   - Flutter를 올리면 apps/client-mobile/pubspec.lock 도 그 버전으로 다시 만들어 같은 커밋에 넣는다.

set -euo pipefail

readonly KUSTOMIZE_VERSION="5.8.1"
readonly KUSTOMIZE_SHA256_AMD64="029a7f0f4e1932c52a0476cf02a0fd855c0bb85694b82c338fc648dcb53a819d"
readonly KUSTOMIZE_SHA256_ARM64="0953ea3e476f66d6ddfcd911d750f5167b9365aa9491b2326398e289fef2c142"

readonly KUBECONFORM_VERSION="0.8.0"
readonly KUBECONFORM_SHA256_AMD64="9bc2bffbf71f261128533edaf912153948b7ff238f9a531ae6d34466ec287883"
readonly KUBECONFORM_SHA256_ARM64="1f53fc8e81258197a35e8603054162a5af1de8c5af13746c71ab680d9534ed87"

# Flutter는 Linux용 공식 배포본이 x64만 있다.
readonly FLUTTER_VERSION="3.47.7"
readonly FLUTTER_SHA256_X64="af7455f540df951184c7953fbe3cf884766e7541dacf8571f9f582db03dd6230"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT

WITH_FLUTTER=false
TMP_DIR=""

# 로그는 stderr로 보낸다. stdout은 `$(resolve_bin_dir)` 같은 함수의 반환값 전용이라, 섞이면 경로가 오염된다.
log() { printf '[setup-toolchain] %s\n' "$*" >&2; }
die() {
  printf '[setup-toolchain] ✖ %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
사용법: bash scripts/setup-toolchain.sh [--with-flutter]

  (옵션 없음)      kustomize, kubeconform 설치 + pnpm install
  --with-flutter   위 항목에 더해 Flutter SDK 설치 (약 2GB, 모바일 검증이 필요할 때만)

환경변수
  TOOLCHAIN_BIN_DIR   실행 파일을 둘 디렉터리 (기본: 쓰기 가능하면 /usr/local/bin, 아니면 ~/.local/bin)
  FLUTTER_HOME        Flutter SDK 위치 (기본: /opt/flutter, 쓸 수 없으면 ~/.local/flutter)
EOF
}

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --with-flutter) WITH_FLUTTER=true ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        die "알 수 없는 옵션: $1"
        ;;
    esac
    shift
  done
}

require_linux() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    die "Linux 전용 스크립트입니다. macOS에서는 README의 '사전 준비'를 따라 brew 등으로 설치하세요."
  fi
}

require_commands() {
  local missing=()
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "필요한 명령이 없습니다: ${missing[*]}"
  fi
}

# uname -m → 배포본 아키텍처 이름
detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo "amd64" ;;
    aarch64 | arm64) echo "arm64" ;;
    *) die "지원하지 않는 아키텍처: $(uname -m)" ;;
  esac
}

resolve_bin_dir() {
  local dir="${TOOLCHAIN_BIN_DIR:-}"
  if [[ -z "$dir" ]]; then
    if [[ -w /usr/local/bin ]]; then
      dir="/usr/local/bin"
    else
      dir="$HOME/.local/bin"
    fi
  fi
  mkdir -p "$dir" || die "디렉터리를 만들 수 없습니다: $dir"
  [[ -w "$dir" ]] || die "쓰기 권한이 없습니다: $dir"
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) log "⚠ $dir 가 PATH에 없습니다. 설치 후 PATH에 추가해야 명령을 찾을 수 있습니다." ;;
  esac
  echo "$dir"
}

# 다운로드 후 sha256이 일치할 때만 파일을 남긴다. 불일치면 파일을 지우고 실패한다.
download_verified() {
  local url="$1" expected_sha="$2" dest="$3"
  log "다운로드: $url"
  curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$dest" "$url" ||
    die "다운로드 실패: $url"
  local actual_sha
  actual_sha="$(sha256sum "$dest" | cut -d' ' -f1)"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    rm -f "$dest"
    die "체크섬 불일치 (변조 또는 손상 가능성). 설치하지 않습니다.
  파일:     $url
  기대값:   $expected_sha
  실제값:   $actual_sha"
  fi
  log "체크섬 확인: ${actual_sha:0:16}…"
}

# 현재 설치된 버전 문자열이 기대값을 포함하면 0.
# `cmd | grep -q` 대신 출력을 먼저 받는다: grep -q가 일찍 끝나면 cmd가 SIGPIPE를 받고,
# pipefail 때문에 "설치돼 있는데 없다"고 판단해 매번 재설치하게 된다.
has_version() {
  local cmd="$1" version_flag="$2" expected="$3" output
  command -v "$cmd" >/dev/null 2>&1 || return 1
  output="$("$cmd" "$version_flag" 2>/dev/null)" || return 1
  [[ "$output" == *"$expected"* ]]
}

# tar.gz 안의 실행 파일 하나를 꺼내 bin 디렉터리에 설치
install_binary_from_tarball() {
  local name="$1" url="$2" sha="$3" bin_dir="$4"
  local archive="$TMP_DIR/$name.tar.gz"
  local extract_dir="$TMP_DIR/$name"
  download_verified "$url" "$sha" "$archive"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir" "$name" || die "$name 압축 해제 실패"
  install -m 0755 "$extract_dir/$name" "$bin_dir/$name" || die "$name 설치 실패: $bin_dir"
}

install_kustomize() {
  local arch="$1" bin_dir="$2"
  if has_version kustomize version "v$KUSTOMIZE_VERSION"; then
    log "kustomize v$KUSTOMIZE_VERSION 이미 설치됨 → 건너뜀"
    return
  fi
  local sha
  case "$arch" in
    amd64) sha="$KUSTOMIZE_SHA256_AMD64" ;;
    arm64) sha="$KUSTOMIZE_SHA256_ARM64" ;;
  esac
  install_binary_from_tarball kustomize \
    "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv${KUSTOMIZE_VERSION}/kustomize_v${KUSTOMIZE_VERSION}_linux_${arch}.tar.gz" \
    "$sha" "$bin_dir"
  has_version "$bin_dir/kustomize" version "v$KUSTOMIZE_VERSION" || die "kustomize 설치 후 버전 확인 실패"
  log "kustomize v$KUSTOMIZE_VERSION 설치 완료"
}

install_kubeconform() {
  local arch="$1" bin_dir="$2"
  if has_version kubeconform -v "v$KUBECONFORM_VERSION"; then
    log "kubeconform v$KUBECONFORM_VERSION 이미 설치됨 → 건너뜀"
    return
  fi
  local sha
  case "$arch" in
    amd64) sha="$KUBECONFORM_SHA256_AMD64" ;;
    arm64) sha="$KUBECONFORM_SHA256_ARM64" ;;
  esac
  install_binary_from_tarball kubeconform \
    "https://github.com/yannh/kubeconform/releases/download/v${KUBECONFORM_VERSION}/kubeconform-linux-${arch}.tar.gz" \
    "$sha" "$bin_dir"
  has_version "$bin_dir/kubeconform" -v "v$KUBECONFORM_VERSION" || die "kubeconform 설치 후 버전 확인 실패"
  log "kubeconform v$KUBECONFORM_VERSION 설치 완료"
}

resolve_flutter_home() {
  local home="${FLUTTER_HOME:-}"
  if [[ -z "$home" ]]; then
    if [[ -w /opt ]]; then
      home="/opt/flutter"
    else
      home="$HOME/.local/flutter"
    fi
  fi
  echo "$home"
}

install_flutter() {
  local arch="$1" bin_dir="$2"
  [[ "$arch" == "amd64" ]] || die "Flutter Linux 배포본은 x64만 있습니다 (현재: $(uname -m))"
  require_commands xz git

  local flutter_home
  flutter_home="$(resolve_flutter_home)"
  # 설치 표식: 버전과 체크섬이 모두 같을 때만 건너뛴다. `flutter --version`은 수 초가 걸려 확인용으로 쓰지 않는다.
  local marker="$flutter_home/.toolchain-installed"
  local expected_marker="$FLUTTER_VERSION $FLUTTER_SHA256_X64"

  if [[ -f "$marker" && "$(cat "$marker")" == "$expected_marker" ]]; then
    log "Flutter $FLUTTER_VERSION 이미 설치됨 ($flutter_home) → 건너뜀"
  else
    local archive="$TMP_DIR/flutter.tar.xz"
    download_verified \
      "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" \
      "$FLUTTER_SHA256_X64" "$archive"
    log "압축 해제 중 (수십 초 걸릴 수 있음)"
    tar -xJf "$archive" -C "$TMP_DIR" || die "Flutter 압축 해제 실패"
    # 압축 해제가 끝까지 성공한 뒤에만 기존 SDK를 바꾼다 (중간 실패 시 기존 SDK 보존)
    rm -rf "$flutter_home"
    mkdir -p "$(dirname "$flutter_home")"
    mv "$TMP_DIR/flutter" "$flutter_home" || die "Flutter 이동 실패: $flutter_home"
    echo "$expected_marker" >"$marker"
    log "Flutter $FLUTTER_VERSION 설치 완료 ($flutter_home)"
  fi

  # SDK는 git 저장소다. 다른 사용자 소유로 풀린 경우 git이 'dubious ownership'으로 거부하므로 신뢰 목록에 넣는다.
  local trusted
  trusted="$(git config --global --get-all safe.directory 2>/dev/null || true)"
  if ! printf '%s\n' "$trusted" | grep -qxF -- "$flutter_home"; then
    git config --global --add safe.directory "$flutter_home"
  fi
  ln -sf "$flutter_home/bin/flutter" "$bin_dir/flutter"
  ln -sf "$flutter_home/bin/dart" "$bin_dir/dart"

  # 사용 통계 전송 끄기 (CI·컨테이너에서 불필요한 외부 전송 방지)
  "$flutter_home/bin/flutter" --disable-analytics >/dev/null 2>&1 ||
    log "⚠ flutter analytics 끄기 실패 (설치에는 영향 없음)"
  log "Flutter 패키지 받는 중: apps/client-mobile"
  (cd "$REPO_ROOT/apps/client-mobile" && "$flutter_home/bin/flutter" pub get) ||
    die "flutter pub get 실패"
}

install_node_dependencies() {
  require_commands pnpm
  log "pnpm install --frozen-lockfile"
  # --frozen-lockfile: lockfile과 package.json이 어긋나면 고쳐 쓰지 않고 실패한다 (의존성이 몰래 바뀌는 것 방지)
  # update-notifier 끄기: 설치 로그에 버전 업데이트 광고 상자가 섞여 실제 오류를 찾기 어려워지는 것 방지
  (cd "$REPO_ROOT" && npm_config_update_notifier=false pnpm install --frozen-lockfile) ||
    die "pnpm install 실패"
}

main() {
  parse_args "$@"
  require_linux
  require_commands curl sha256sum tar install

  TMP_DIR="$(mktemp -d)"
  local arch bin_dir
  arch="$(detect_arch)"
  bin_dir="$(resolve_bin_dir)"
  log "아키텍처: $arch · 설치 위치: $bin_dir"

  install_kustomize "$arch" "$bin_dir"
  install_kubeconform "$arch" "$bin_dir"
  if [[ "$WITH_FLUTTER" == true ]]; then
    install_flutter "$arch" "$bin_dir"
  else
    log "Flutter는 건너뜀 (필요하면 --with-flutter)"
  fi
  install_node_dependencies

  log "✔ 완료"
}

main "$@"
