#!/usr/bin/env bash
# SessionStart hook: 검증 도구가 있는지 "확인만" 한다. 아무것도 설치하지 않는다.
#
# 왜 확인만 하는가
#   Claude Code는 SessionStart hook이 끝나야 세션의 첫 메시지를 읽는다.
#   여기서 다운로드를 하면 세션 시작이 그만큼 멈춘다. 설치는 scripts/setup-toolchain.sh 의 몫이다.
#
# 왜 필요한가
#   환경 setup script가 실패했거나 아직 설정되지 않은 세션에서도, Agent가 "어떤 검증을 할 수 없는지"
#   처음부터 알고 시작하게 한다. 도구가 없어 실패한 검증을 "통과"로 기록하는 일을 막는다.
#
# 규칙
#   - bash 내장 명령만 쓴다 (외부 프로그램 실행 없음 → 수 밀리초 안에 끝난다).
#   - 항상 0으로 끝난다. 확인 결과 때문에 세션 시작을 막지 않는다.
#   - 모두 갖춰져 있으면 아무것도 출력하지 않는다 (매 세션 컨텍스트를 아낀다).
#   - 출력에는 고정된 문구만 쓴다. 외부에서 온 텍스트를 그대로 내보내지 않는다.

# hook 입력(JSON)을 내장 명령으로 비운다. 보내는 쪽이 파이프 종료로 실패하지 않게 하려는 것.
while IFS= read -r _; do :; done

missing_infra=()
for tool in kustomize kubeconform; do
  command -v "$tool" >/dev/null 2>&1 || missing_infra+=("$tool")
done

project_dir="${CLAUDE_PROJECT_DIR:-.}"
node_modules_missing=false
[[ -d "$project_dir/node_modules" ]] || node_modules_missing=true

flutter_missing=false
command -v flutter >/dev/null 2>&1 || flutter_missing=true

if [[ ${#missing_infra[@]} -eq 0 && "$node_modules_missing" == false && "$flutter_missing" == false ]]; then
  exit 0
fi

echo "[toolchain] 이 세션의 검증 도구 상태:"
if [[ "$node_modules_missing" == true ]]; then
  echo "- node_modules 없음: lint/typecheck/test 전에 'pnpm install --frozen-lockfile' 필요"
fi
if [[ ${#missing_infra[@]} -gt 0 ]]; then
  echo "- 없음: ${missing_infra[*]} → 인프라 검증 전에 'bash scripts/setup-toolchain.sh' 실행 (Linux)"
fi
if [[ "$flutter_missing" == true ]]; then
  echo "- flutter 없음 (기본 설치 대상 아님) → 모바일 검증이 필요하면 'bash scripts/setup-toolchain.sh --with-flutter'"
fi
echo "설치하지 못한 도구가 필요한 검증은 실행한 것처럼 기록하지 말고, 이슈 로그에 '검증 미실행: <도구> 없음'으로 남긴다."
exit 0
