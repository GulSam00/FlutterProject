#!/usr/bin/env bash
# 이슈 파일이 `CLAUDE.md` "이슈 작업 절차" 를 지키는지 검사한다.
#
# 사용법: bash scripts/validate-issues.sh
#
# 왜 필요한가
#   절차는 전부 지시문이라, 사람이 IDE 에서 바로 커밋하거나 Agent 가 단계를 놓치면 아무것도 막지 못한다.
#   특히 "검증했다" 는 기록을 믿을 수밖에 없는 구조였다. 기계로 확인할 수 있는 항목만이라도 여기서 막는다.
#
# 검사하는 것 (기계로 판정 가능한 것만)
#   1. 파일 이름이 `YYYY-MM-DD-slug.md` 형식인가
#   2. frontmatter `id` 가 파일 이름과 같은가
#   3. `status` 가 허용된 값인가
#   4. `status: done` 인데 체크 안 된 완료 조건(`- [ ]`)이 남아 있지 않은가
#   5. 필수 섹션(현재 상태 / 배경 / 완료 조건 / 변경 로그)이 있는가
#   6. 변경 로그에 항목이 하나 이상 있는가
#
# 검사하지 않는 것
#   "로그에 적힌 검증을 실제로 실행했는가" 는 기계로 알 수 없다. 그래서 CI 가 검증 명령을 직접 다시 돌린다.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly ISSUE_DIR="$REPO_ROOT/docs/issues"

problems=()
checked=0

add_problem() { problems+=("$1"); }

# frontmatter 의 키 값 하나를 읽는다 (--- 블록 안에서만)
frontmatter_value() {
  local file="$1" key="$2"
  awk -v key="$key" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    $0 ~ "^" key ": " { sub("^" key ": ", ""); sub(/ *#.*$/, ""); print; exit }
  ' "$file"
}

shopt -s nullglob
for file in "$ISSUE_DIR"/*.md; do
  name="$(basename "$file")"
  # 템플릿과 안내 문서는 이슈가 아니다
  [[ "$name" == "_TEMPLATE.md" || "$name" == "README.md" ]] && continue

  checked=$((checked + 1))
  stem="${name%.md}"

  if [[ ! "$stem" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    add_problem "$name: 파일 이름이 YYYY-MM-DD-kebab-slug 형식이 아닙니다"
    continue
  fi

  id="$(frontmatter_value "$file" id)"
  if [[ "$id" != "$stem" ]]; then
    add_problem "$name: frontmatter id 가 파일 이름과 다릅니다 (id: '${id:-없음}')"
  fi

  status="$(frontmatter_value "$file" status)"
  case "$status" in
    todo | in-progress | blocked | done) ;;
    *) add_problem "$name: status 값이 올바르지 않습니다 ('${status:-없음}'). todo|in-progress|blocked|done" ;;
  esac

  # 완료 조건 섹션 안에서만 체크박스를 센다 (다른 섹션의 목록과 섞이지 않게)
  unchecked="$(awk '/^## 완료 조건/{inside=1; next} /^## /{inside=0} inside && /^- \[ \]/{count++} END{print count+0}' "$file")"
  if [[ "$status" == "done" && "$unchecked" -gt 0 ]]; then
    add_problem "$name: status 가 done 인데 체크되지 않은 완료 조건이 ${unchecked}건 있습니다"
  fi

  for section in '## 현재 상태' '## 배경' '## 완료 조건' '## 변경 로그'; do
    grep -qxF "$section" "$file" || add_problem "$name: '$section' 섹션이 없습니다"
  done

  entries="$(awk '/^## 변경 로그/{inside=1; next} /^## /{inside=0} inside && /^### /{count++} END{print count+0}' "$file")"
  if [[ "$entries" -eq 0 ]]; then
    add_problem "$name: 변경 로그에 항목이 없습니다 (최소 1건: 이슈 생성 기록)"
  fi
done
shopt -u nullglob

if [[ "$checked" -eq 0 ]]; then
  printf '[validate-issues] ✖ %s 에 이슈 파일이 없습니다\n' "$ISSUE_DIR" >&2
  exit 1
fi

if [[ ${#problems[@]} -gt 0 ]]; then
  printf '[validate-issues] ✖ 이슈 %d개 중 %d건의 문제\n\n' "$checked" "${#problems[@]}" >&2
  for problem in "${problems[@]}"; do printf '  - %s\n' "$problem" >&2; done
  printf '\n  절차는 루트 CLAUDE.md "이슈 작업 절차" 를 참고하세요.\n' >&2
  exit 1
fi

printf '[validate-issues] ✔ 이슈 %d개가 절차를 지킵니다\n' "$checked"
