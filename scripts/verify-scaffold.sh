#!/usr/bin/env bash
# 생성기 템플릿이 아직 유효한지 검증한다.
#
# 사용법: bash scripts/verify-scaffold.sh
#
# 하는 일: 임시 도메인을 생성 → lint·typecheck·test·format·flutter analyze → **반드시 되돌린다**
#
# 왜 필요한가
#   템플릿은 컴파일 대상이 아니라서 조용히 낡는다. 공통 클래스의 이름이 바뀌거나
#   `BaseEntity` 의 필드가 달라져도 템플릿은 그대로 남아, 다음 도메인을 만들 때 처음 알게 된다.
#   이 스크립트를 CI 에 넣으면 그 순간 깨진다.
#
# 안전장치
#   끝에서 생성물을 되돌리므로, 되돌릴 경로에 사용자의 변경이 있으면 시작하지 않는다.
#   작업 트리 전체를 요구하지는 않는다. 그러면 다른 작업 중에는 템플릿을 검증할 수 없어
#   "검증을 건너뛰는" 쪽으로 기울기 때문이다.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
# 실제 도메인과 겹치지 않을 이름. 되돌리기에 실패해도 무엇인지 바로 알 수 있게 접두사를 붙인다.
readonly DOMAIN="scaffoldprobe"

log() { printf '[verify-scaffold] %s\n' "$*" >&2; }
die() {
  printf '[verify-scaffold] ✖ %s\n' "$*" >&2
  exit 1
}

cd "$REPO_ROOT"

# 이 스크립트가 수정·삭제하는 경로들. 되돌리기의 대상이기도 하다.
REGISTRATION_FILES=(
  packages/shared-types/src/index.ts
  apps/server-api/src/app.module.ts
)
GENERATED_PATHS=(
  "packages/shared-types/src/$DOMAIN.ts"
  "apps/server-api/src/modules/$DOMAIN"
  "apps/client-web/src/features/$DOMAIN"
  "apps/client-mobile/lib/features/$DOMAIN"
)

dirty="$(git status --porcelain -- "${REGISTRATION_FILES[@]}" "${GENERATED_PATHS[@]}")"
if [[ -n "$dirty" ]]; then
  die "되돌릴 경로에 변경이 있어 시작하지 않습니다 (지울 위험이 있습니다):
$dirty"
fi

cleanup() {
  local status=$?
  log "생성물 되돌리기"
  # 등록 지점(index.ts, app.module.ts) 수정 복원 + 생성된 파일 제거
  git -C "$REPO_ROOT" checkout -- "${REGISTRATION_FILES[@]}" 2>/dev/null || true
  local path
  for path in "${GENERATED_PATHS[@]}"; do
    rm -rf "$REPO_ROOT/$path"
  done
  local leftover
  leftover="$(git -C "$REPO_ROOT" status --porcelain -- "${REGISTRATION_FILES[@]}" "${GENERATED_PATHS[@]}")"
  if [[ -n "$leftover" ]]; then
    printf '[verify-scaffold] ⚠ 되돌리지 못한 변경이 있습니다:\n%s\n' "$leftover" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

log "임시 도메인 생성: $DOMAIN"
node scripts/scaffold-domain.mjs "$DOMAIN" >/dev/null || die "생성 실패"

# 생성된 계약을 다른 패키지가 import 하므로 shared-types 를 먼저 빌드한다
log "shared-types 빌드"
pnpm --filter @repo/shared-types build >/dev/null || die "shared-types 빌드 실패"

log "lint · typecheck · test"
pnpm turbo run lint typecheck test --output-logs=errors-only ||
  die "검증 실패 — 템플릿이 현재 코드와 맞지 않습니다"

log "format:check"
pnpm format:check >/dev/null || die "생성된 파일이 Prettier 규칙과 맞지 않습니다"

if command -v flutter >/dev/null 2>&1; then
  log "flutter analyze · test"
  pnpm mobile:analyze >/dev/null || die "flutter analyze 실패"
  pnpm mobile:test >/dev/null || die "flutter test 실패"
else
  log "⚠ flutter 없음 → 모바일 템플릿 검증 미실행 (bash scripts/setup-toolchain.sh --with-flutter)"
fi

log "✔ 템플릿 검증 통과"
