#!/usr/bin/env bash
# 검증에 필요한 도구가 없으면 설치한다. 있으면 아무것도 하지 않는다.
#
# 사용법: bash scripts/ensure-tools.sh kustomize kubeconform
#         bash scripts/ensure-tools.sh flutter
#
# 왜 필요한가 (docs/issues/2026-11-04-session-start-toolchain-hook.md)
#   컨테이너는 세션마다 새로 만들어지고 검증 도구가 없다. 그러면 두 가지 중 하나가 된다.
#   매번 손으로 설치하거나, **검증을 건너뛴다.** 후자가 위험하다. 실패한 명령을 무시하고
#   이슈 로그에 "검증 통과" 로 적으면, 이 저장소가 지켜 온 "기록을 믿을 수 있다" 는 전제가 깨진다.
#
#   그래서 검증 명령 자체가 필요한 도구를 준비하게 했다. 환경 설정(Setup script)으로 미리 깔아 두는 것은
#   첫 실행을 빠르게 하는 선택일 뿐, 검증의 전제 조건이 아니다.
#
#   SessionStart hook 에서 설치하지 않는 이유는 `scripts/check-toolchain.sh` 주석에 있다
#   (Claude Code 가 hook 이 끝나야 첫 메시지를 읽으므로 세션 시작이 그만큼 멈춘다).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT

log() { printf '[ensure-tools] %s\n' "$*" >&2; }

[[ $# -gt 0 ]] || {
  printf '[ensure-tools] ✖ 확인할 도구 이름이 필요합니다\n' >&2
  exit 1
}

missing=()
for tool in "$@"; do
  command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done

if [[ ${#missing[@]} -eq 0 ]]; then
  exit 0
fi

log "없는 도구: ${missing[*]}"

if [[ "$(uname -s)" != "Linux" ]]; then
  printf '[ensure-tools] ✖ %s 가 없습니다. 자동 설치는 Linux 전용이므로 README "사전 요구사항" 을 따라 설치하세요.\n' \
    "${missing[*]}" >&2
  exit 1
fi

# flutter 가 필요하면 SDK 까지 설치한다 (기본 설치 대상이 아니다)
args=()
for tool in "${missing[@]}"; do
  [[ "$tool" == "flutter" || "$tool" == "dart" ]] && args+=(--with-flutter)
done

log "설치 시작: bash scripts/setup-toolchain.sh ${args[*]:-}"
bash "$REPO_ROOT/scripts/setup-toolchain.sh" "${args[@]}" || {
  printf '[ensure-tools] ✖ 설치 실패. 이 검증은 실행한 것처럼 기록하지 말고 "검증 미실행: %s 없음" 으로 남기세요.\n' \
    "${missing[*]}" >&2
  exit 1
}

# 설치 후에도 없으면 PATH 문제다. 조용히 넘어가면 다음 명령이 알 수 없는 이유로 실패한다.
still_missing=()
for tool in "${missing[@]}"; do
  command -v "$tool" >/dev/null 2>&1 || still_missing+=("$tool")
done
if [[ ${#still_missing[@]} -gt 0 ]]; then
  printf '[ensure-tools] ✖ 설치 후에도 찾을 수 없습니다: %s\n  설치 위치가 PATH 에 있는지 확인하세요 (TOOLCHAIN_BIN_DIR).\n' \
    "${still_missing[*]}" >&2
  exit 1
fi

log "✔ 준비 완료: ${missing[*]}"
