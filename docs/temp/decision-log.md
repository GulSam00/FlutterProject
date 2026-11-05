# 자율 판단 기록 (임시)

> **임시 파일이다.** 사용자가 "선택이 필요한 부분은 자의적으로 판단하고, 왜 그렇게 골랐는지 따로 남기라"고 지시해서 만든 파일이다.
> 사용자가 검토한 뒤 채택한 결정은 각 이슈 파일이나 `CLAUDE.md`로 옮기고, 이 파일은 지운다.
>
> - 이슈 작업 이력(무엇을 했고 무엇을 검증했는지)은 각 이슈 파일의 변경 로그에 남긴다. 여기에는 **판단과 그 이유만** 적는다.
> - 새 항목은 맨 위에 넣는다 (최신순). 기존 항목은 고치지 않는다.
> - 형식:
>
>   ```markdown
>   ### YYYY-MM-DD · <이슈 ID 또는 "orchestration">
>
>   - 결정: 무엇을 골랐는지
>   - 대안: 검토했지만 버린 것
>   - 이유: 왜 이걸 골랐는지 (근거가 된 사실, 명령 결과 포함)
>   - 되돌리려면: 사용자가 다른 선택을 원할 때 무엇을 바꾸면 되는지
>   ```

## 기록

### 2026-11-05 · 2026-11-04-domain-scaffold-generator

- 결정: 의존성 없는 Node 스크립트(`scripts/scaffold-domain.mjs`) + 파일 템플릿으로 만들었다.
- 대안: ① plop ② Nest schematics ③ LLM Agent(원래 이슈가 버린 안)
- 이유: 생성 대상이 TypeScript 3곳과 **Dart 1곳**이다. plop·schematics 는 Nest/JS 생태계 쪽만 돕고,
  Dart 파일 생성은 결국 문자열 치환이다. 템플릿 엔진이 해 주는 일이 치환뿐이라면 의존성을 늘릴 값이 없다.
  schematics 는 서버 한 곳만 커버해서 "네 곳에 같은 구조" 라는 요구를 못 채운다.
- 되돌리려면: `scripts/scaffold-domain.mjs`, `scripts/templates/`, `scripts/verify-scaffold.sh` 를 지우고
  루트 `package.json` 의 `scaffold*` 스크립트와 `CLAUDE.md` 2곳의 안내를 제거하면 된다.

### 2026-11-05 · 2026-11-04-domain-scaffold-generator

- 결정: 생성되는 엔티티에 자리표시자 필드 `name` 을 하나 둔다. 필드가 전혀 없는 뼈대로 만들지 않았다.
- 대안: 필드 없는 엔티티(컬럼은 `BaseEntity` 상속분만)
- 이유: 필드가 없으면 생성 결과가 typecheck·lint·test 를 통과하는지 검증할 수 없다
  (DTO·응답 변환·테스트가 모두 빌 내용이 된다). 그러면 `verify-scaffold.sh` 가 템플릿이 낡았는지 알려주지 못한다.
  "도메인 로직을 넣지 않는다" 는 원칙은 지킨다. `name` 은 비즈니스 의미가 없는 자리표시자이고,
  생성된 모든 파일의 머리말 주석이 교체하라고 명시한다.
- 되돌리려면: 템플릿에서 `name` 관련 줄을 지우면 된다. 단 생성 결과가 검증 가능한 상태가 아니게 된다.

### 2026-11-05 · 2026-11-04-domain-scaffold-generator

- 결정: "CI 에서 템플릿 검증" 완료 조건을 이 이슈에서 떼어 `2026-11-05-add-ci-pipeline` 으로 분리했다.
  대신 CI 가 호출할 명령(`pnpm scaffold:verify`)을 이 이슈에서 만들고 실제로 통과시켰다.
- 대안: ① 이 이슈에서 GitHub Actions 워크플로를 함께 만든다 ② CI 없이 조건을 체크 처리
- 이유: 이 저장소에는 CI 가 전혀 없다(`.github/` 디렉터리 자체가 없다). CI 를 세우는 일은
  러너 환경·도구 설치·Flutter 설치 조건·이슈 절차 검사까지 걸리는 별도 작업이고,
  생성기 이슈에 끼워 넣으면 둘 다 흐려진다. ②는 규칙 7 위반이다.
  검증 자체는 명령으로 만들어 통과시켰으니, 남은 것은 "언제 돌릴지" 뿐이다.
- 되돌리려면: 새 이슈를 닫고 이 이슈에 CI 작업을 다시 합치면 된다.

### 2026-11-05 · 2026-11-04-add-web-test-runner

- 결정: Vitest **5.0.5** 를 쓴다. jsdom·@testing-library 는 들이지 않고 `environment: 'node'` 로 둔다.
- 대안: ① 서버와 같은 Jest ② 최신 Vitest 5.1.0 ③ jsdom 환경 + @testing-library 까지 한 번에
- 이유:
  - ①Jest 는 Next 15 의 ESM·TS 구성에서 설정이 길어진다 (transform, moduleNameMapper, ts-jest/babel).
    Vitest 는 Vite 의 변환을 그대로 쓰므로 설정이 짧고, 실행도 0.3초대다. 서버는 이미 Jest 로 잘 돌고 있어
    "저장소 전체가 한 실행기" 라는 가치보다 각 앱에 맞는 도구가 낫다고 봤다.
  - ②5.1.0 은 출시 3일 뒤였다. 보일러플레이트의 기본 의존성으로 쓰기엔 검증 기간이 짧다.
    5.0.5 는 3주 지난 같은 메이저의 안정 버전이다.
  - ③이 이슈의 범위 밖(컴포넌트 렌더링)이고, jsdom 은 느리고 실제 브라우저와 다르게 동작하는 지점이 있다.
    테스트하려던 대상(api-client, fetchHealthReport)은 DOM 이 필요 없다. 필요해질 때 들이면 된다.
- 되돌리려면: `apps/client-web/vitest.config.mts` 와 `*.test.ts` 들을 지우고 `package.json` 의
  `test` 스크립트, `turbo.json` 의 `@app/client-web#test` 항목을 제거하면 된다.

### 2026-11-05 · 2026-11-04-add-web-test-runner

- 결정: `.prettierignore` 를 만들어 `pnpm-lock.yaml` 과 `pubspec.lock` 을 포맷 대상에서 뺐다.
  이슈 범위 밖이지만 새 이슈로 분리하지 않고 이 커밋에 포함했다.
- 대안: ① lockfile 을 prettier 로 포맷해 기존 상태 유지 ② 새 이슈로 분리
- 이유: ①은 `pnpm install` 이 lockfile 을 다시 쓰는 순간 `format:check` 가 또 실패한다.
  이번에 vitest 를 추가하면서 실제로 겪었고, 의존성을 추가하는 사람마다 반복된다.
  ②는 이 변경이 "의존성 추가" 라는 이 이슈의 작업 때문에 드러났고, 한 줄 설정이라
  따로 추적할 가치보다 같이 고치는 편이 낫다고 봤다. 규칙 8 은 "범위 밖 문제" 를 새 이슈로 두라는 것이고,
  여기서는 이 이슈의 작업이 만든 부작용이라 범위 안으로 판단했다.
- 되돌리려면: `.prettierignore` 를 지우고 `package.json` 의 `--ignore-path .prettierignore` 를 제거한 뒤
  `pnpm format` 으로 lockfile 을 다시 포맷하면 된다.

### 2026-11-05 · 2026-11-04-session-start-toolchain-hook

- 결정: 이 이슈를 `done` 이 아니라 `blocked` 로 둔다. 그리고 남은 사용자 작업을 별도 이슈로 쪼개지 않는다.
- 대안: ① 저장소 쪽 작업만 떼어 `done` 처리하고 환경 설정 확인을 새 이슈로 분리
  ② 검증 못 한 항목을 체크하고 `done` 으로
- 이유: ②는 `CLAUDE.md` 규칙 7 위반이고, 이 저장소가 계속 막아 온 "검증하지 않은 것을 통과로 기록" 그 자체다.
  ①은 상태를 초록으로 만들려고 이슈를 쪼개는 셈이어서, 쪼갠 이유가 작업의 성질이 아니라 보여주기가 된다.
  환경 설정과 저장소 쪽 스크립트는 하나가 동작해야 다른 하나가 의미를 갖는 한 묶음이다.
  `blocked` + 막힌 이유 명시가 규칙이 정한 처리이고, 사용자가 무엇을 해야 하는지도 가장 분명하게 남는다.
- 되돌리려면: 사용자가 Setup script 를 추가하고 새 세션에서 도구 설치를 확인하면 남은 두 항목을 체크하고
  `done` 으로 바꾸면 된다.

### 2026-11-05 · 2026-11-04-verify-tini-signal-handling

- 결정: Alpine 저장소가 막힌 문제를 **빌드 옵션**(`--network=host` + 프록시 build-arg)으로 우회해 검증했다.
  Dockerfile 은 한 줄도 고치지 않았다.
- 대안: ① 처음 구축 때처럼 `apk` 줄을 뺀 사본으로 빌드 ② 이슈를 `blocked` 로 두고 넘김
- 이유: ①은 검증 대상(tini)을 빼고 검증하는 것이라 이 이슈의 목적을 달성하지 못한다.
  처음 구축 때 이 항목이 미검증으로 남은 이유가 바로 그것이었다.
  ②는 호스트에서 저장소 접근이 가능한 것을 확인한 뒤라면 성급하다. 빌드 컨테이너에 프록시만 전달하면 되는 문제였다.
  커밋된 Dockerfile 그대로 빌드해서 PID 1·종료 코드·좀비 수거까지 확인하는 것이 이 이슈가 요구한 전부다.
- 되돌리려면: 되돌릴 코드 변경이 없다. 다만 `pnpm docker:up` 자체는 여전히 실패하므로,
  그 문제는 `docs/issues/2026-11-04-docker-compose-build-blocked-by-proxy.md` 로 분리했다.

### 2026-11-05 · 2026-11-04-restrict-health-detail-exposure

- 결정: 차단을 **서버 측 응답 축소**로 구현했다. `HEALTH_EXPOSE_DETAILS`(기본 false)가 false 면 공개 응답은
  `{status, checkedAt}` 까지만 담는다. 컴포넌트별 up/down 까지 지웠고, 전체 보고서는 서버 로그로 돌렸다.
- 대안: ① Ingress 에서 `/api/v1/health` 경로 차단 ② 토큰(`X-Health-Token`)을 제시하면 상세 공개
  ③ 컴포넌트별 up/down 은 공개하고 수치만 숨김
- 이유:
  - ①은 표준 Ingress 로는 "거부" 규칙을 쓸 수 없다. `configuration-snippet` 류 annotation 은
    `CLAUDE.md` 금지 사항(CVE-2025-1974)이라 쓸 수 없고, 더미 서비스로 404 를 내는 구성은 복잡한데
    모바일 앱 진단 화면(Ingress 경유)까지 같이 막힌다.
  - ②는 보안 모델이 성립하지 않는다. 웹 진단 화면은 인증이 없어서, 서버 측 토큰으로 상세를 받아 렌더링하면
    그 페이지를 여는 누구나 상세를 보게 된다. 모바일 앱은 비밀을 안전하게 보관할 수 없다.
    결국 토큰은 운영자 curl 과 SSR 만 득을 보는데, 관리할 비밀이 하나 늘고 "가려졌다"는 착각을 준다.
  - ③은 이슈가 지적한 핵심 위험(의존성이 흔들리는 시점을 골라 공격)을 그대로 남긴다.
    "지금 redis 가 down" 자체가 공격 시점 신호다.
  - 그래서 공개 엔드포인트는 "트래픽을 받을 수 있는가"(200/503)까지만 답하게 했다. 이게 K8s probe 와
    로드밸런서가 실제로 필요한 전부다. 원인 추적은 서버 로그와, 신뢰된 환경에서 켜는 상세 모드가 담당한다.
- 되돌리려면: 상세를 공개하려면 해당 환경의 `HEALTH_EXPOSE_DETAILS=true` 로만 바꾸면 된다
  (코드 변경 없음). 공개 범위를 ③처럼 "컴포넌트 상태까지"로 넓히려면
  `apps/server-api/src/modules/health/health-report.redaction.ts` 의 `redactHealthReport` 만 고치면 된다.

### 2026-11-05 · 2026-11-04-restrict-health-detail-exposure

- 결정: dev overlay 에서도 `HEALTH_EXPOSE_DETAILS` 를 켜지 않았다 (base 의 false 를 그대로 쓴다).
- 대안: dev overlay 에 `HEALTH_EXPOSE_DETAILS=true` 추가
- 이유: dev 도 `api.dev.example.com` 으로 외부에 노출되는 배포 환경이다. "dev 니까 괜찮다"는 가정이
  스테이징·시연 환경에서 그대로 새는 경로가 된다. 로컬 compose 는 이미 true 라 개발 경험은 유지된다.
- 되돌리려면: `infra/k8s/overlays/dev/kustomization.yaml` 의 `configMapGenerator.literals` 에
  `HEALTH_EXPOSE_DETAILS=true` 한 줄을 추가하면 된다 (`behavior: merge` 라 base 값을 덮어쓴다).

### 2026-11-05 · 2026-11-04-k8s-validation-false-pass

- 결정: 검증을 `scripts/validate-k8s.sh` 스크립트로 옮기고, 루트 `CLAUDE.md` 와 README 의 명령을 이 스크립트 호출로 바꿨다.
  `secrets.env` 가 없으면 `secrets.env.example` 을 임시 복사본에만 넣어 렌더링한다.
- 대안: ① 기존 파이프 명령에 `set -o pipefail` 과 `-summary` 출력 파싱만 추가 ② `secrets.env` 를 작업 트리에 복사한 뒤 검증
- 이유: ①은 "리소스 0개"를 잡지 못한다. kubeconform 은 빈 입력에도 0으로 끝나므로, pipefail 만으로는
  kustomize 가 실패한 경우만 걸러진다. 또 overlay 두 개를 각각 돌려야 해서 `CLAUDE.md` 한 줄에 담기 어렵다.
  ②는 example 값이 진짜 `secrets.env` 처럼 작업 트리에 남는다. 그 상태로 `kubectl apply` 를 하면
  `change_me` 비밀번호가 배포될 수 있다. 임시 복사본은 이 위험이 없다.
- 되돌리려면: `CLAUDE.md` 와 README 의 명령을 되돌리고 `scripts/validate-k8s.sh` 를 지우면 된다.
  단 그러면 이슈의 거짓 통과 문제가 그대로 돌아온다.

### 2026-11-05 · orchestration

- 결정: 이슈마다 새 세션을 만드는 방식을 포기하고, 이 세션에서 이슈를 우선순위대로 하나씩 처리한다.
  이슈 하나 = 커밋 하나 + 이슈 로그 항목 하나를 단위로 삼는다.
- 대안: 하위 세션 생성을 계속 재시도
- 이유: 첫 하위 세션(`session_01RQgZdtBjAZZFMmvAyAj7Ju`)은 환경 Setup script 실패로 시작하지 못했다
  (`cd: /home/user/singcode: No such file or directory`, exit 1). 사용자가 Setup script 를 고친 뒤 다시 시도하려 했으나,
  하위 세션을 자동으로 만들어 작업을 넘기려는 응답이 안전 분류기에 의해 세 번 중단됐다. 같은 시도를 반복하는 대신
  이 세션에서 직접 처리하는 쪽이 실제로 작업을 끝낼 수 있는 방법이라고 판단했다. 세션 분리는 작업 결과물
  (커밋 단위, 이슈 로그, 판단 기록)에는 영향을 주지 않는다.
- 되돌리려면: 사용자가 이슈별로 세션을 직접 열고, 그 세션에 이슈 ID 만 알려주면 된다.
  필요한 규칙은 모두 저장소(`CLAUDE.md`, 이슈 파일, 이 파일)에 있어서 새 세션도 같은 방식으로 작업할 수 있다.

### 2026-11-05 · orchestration

- 결정: 이슈마다 새 클라우드 세션을 하나씩 열고, **한 번에 하나씩 순서대로** 진행한다. 모든 세션은 같은 브랜치
  `claude/festive-franklin-pk7qxz`에 직접 push한다.
- 대안: 여러 세션을 동시에 실행
- 이유: 모든 이슈가 같은 브랜치에 커밋한다. 동시에 돌리면 push가 서로 충돌하고, 특히 같은 파일(루트 `CLAUDE.md`,
  이 판단 기록 파일)을 동시에 고치게 된다. 그리고 뒤 이슈가 앞 이슈의 결과에 기대는 경우가 있다
  (예: 생성기 이슈는 웹 테스트 실행기가 있어야 생성 결과를 검증할 수 있다).
- 되돌리려면: 서로 영향이 없는 이슈(예: P3 타입 정리 두 건)는 동시에 실행해도 된다

### 2026-11-05 · orchestration

- 결정: 진행 순서. 우선순위(P1 → P2 → P3)를 먼저 따르고, 같은 우선순위 안에서는 앞 이슈의 결과가 필요한 이슈를 뒤로 보낸다.
  1. `2026-11-04-k8s-validation-false-pass` (P1)
  2. `2026-11-04-restrict-health-detail-exposure` (P1)
  3. `2026-11-04-verify-tini-signal-handling` (P1)
  4. `2026-11-04-session-start-toolchain-hook` (P2, 진행 중)
  5. `2026-11-04-add-web-test-runner` (P2)
  6. `2026-11-04-domain-scaffold-generator` (P2)
  7. `2026-11-04-remove-cast-in-exception-filter` (P3)
  8. `2026-11-04-typed-test-mocks` (P3)
  9. `2026-11-04-generate-dart-contract-models` (P3)
- 대안: 직전 답변에서 제안한 "서로 막고 있는 관계 우선" 순서 (P3 cast 제거와 웹 테스트 실행기를 P1보다 앞에 둠)
- 이유: 사용자가 "우선순위대로"라고 명시했다. 의존 관계는 같은 우선순위 안에서만 반영했다.
  - P1 안에서는 k8s 검증 버그를 맨 앞에 둔다. 이게 고쳐져야 2번(Ingress 변경)의 인프라 검증 결과를 믿을 수 있다.
  - 2번의 "웹 화면이 깨지지 않음" 조건은 "테스트 또는 수동 확인"이라 웹 테스트 실행기가 없어도 진행할 수 있다.
  - tini 검증은 환경 제약(Alpine 저장소, Docker Hub 요청 제한)으로 막힐 수 있어서 P1의 마지막에 둔다.
    막혀도 앞의 두 이슈에는 영향이 없다.
  - 4번은 남은 조건이 사용자 작업(환경 Setup script 설정)이다. 새 세션에서 hook이 실제로 실행되는지는 확인할 수 있으니 P2의 처음에 둔다.
- 되돌리려면: 이 목록의 순서를 바꾸면 된다. 각 이슈는 독립된 세션에서 처리되므로 순서만 바뀐다
