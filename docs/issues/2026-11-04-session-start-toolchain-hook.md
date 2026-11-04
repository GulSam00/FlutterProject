---
id: 2026-11-04-session-start-toolchain-hook
title: 클라우드 세션 시작 시 검증 도구 자동 설치 (kustomize, kubeconform)
status: in-progress
priority: P2
area: [infra, mobile]
created: 2026-11-04
updated: 2026-11-04
---

# 클라우드 세션 시작 시 검증 도구 자동 설치

## 현재 상태

저장소 쪽 작업(설치 스크립트, 확인 hook, 문서)은 끝났고 이 컨테이너에서 검증했다.
남은 것은 사용자 작업 두 가지다: 환경 설정 Setup script에 README의 두 줄 추가 → 새 세션에서 자동 설치와 hook 메시지 확인.
그래서 `done`이 아니라 `in-progress`로 둔다.

## 배경

루트 `CLAUDE.md`의 "검증" 절차는 `flutter`, `kustomize`, `kubeconform`이 필요하다.
그런데 클라우드 세션 컨테이너는 매번 새로 만들어지고, 이 도구들이 기본으로 없다.
그 결과 새 세션은 다음 둘 중 하나가 된다.

- 매번 도구를 수동으로 설치하느라 시간을 쓴다.
- 설치하지 않고 검증을 건너뛴다. 가장 위험한 경우는 실패한 명령을 무시하고 "검증 완료"로 기록하는 것이다.

## 완료 조건

- [x] `scripts/setup-toolchain.sh`: 버전 고정, sha256 검증, 이미 있으면 건너뜀, 실패 시 0이 아닌 코드로 종료
- [x] Flutter는 기본 설치에서 제외하고 `--with-flutter`로만 설치
- [x] SessionStart hook(`.claude/settings.json` → `scripts/check-toolchain.sh`): 설치 없이 확인만, 누락 시 안내 출력
- [x] 이 컨테이너에서 스크립트를 실행해 `kustomize build ... | kubeconform`과 (`--with-flutter` 후) `pnpm mobile:analyze`가 동작함을 확인
- [x] 체크섬이 다르면 설치하지 않고 실패함을 확인
- [x] 환경 setup script에 넣을 명령을 README에 기록
- [x] `apps/client-mobile/CLAUDE.md`의 "Flutter SDK가 기본으로 없다" 문장 교체
- [ ] **(사용자)** 환경 설정의 Setup script에 README의 명령을 추가
- [ ] **(사용자 + 새 세션)** 새 세션에서 hook 메시지와 도구 자동 설치를 확인

## 범위 밖

- 로컬 개발자 PC의 도구 설치 안내 (README에 있음)
- CI의 도구 설치

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: `scripts/setup-toolchain.sh`(설치), `scripts/check-toolchain.sh` + `.claude/settings.json`(SessionStart 확인 hook) 추가.
  README에 "Claude 클라우드 세션 설정" 절, 루트 `CLAUDE.md` 검증 절에 도구 설치 안내, `apps/client-mobile/CLAUDE.md` 문장 교체.
  `.gitignore`에 `.claude/settings.local.json` 추가.
  작성 후 실행 전에 스스로 찾은 버그 2건 수정: ① `log`가 stdout으로 나가 `$(resolve_bin_dir)` 결과를 오염시킬 수 있었음 → stderr로 변경
  ② `cmd | grep -q` + `pipefail` 조합에서 SIGPIPE로 "설치돼 있는데 없음" 판정 가능 → 출력을 먼저 받아 비교
- 검증:
  - `bash -n` 두 스크립트 → 통과. shellcheck는 `npx` 실행이 권한 정책(외부 코드 실행)으로 거부되어 **미실행**
  - 체크섬 변조 사본(kubeconform sha를 0으로) → kubeconform 설치 안 됨, exit 1, 임시 디렉터리 정리됨
  - 실제 설치 1회차 17.7초 / 2회차 1.4초 ("이미 설치됨 → 건너뜀"), `kustomize version` → v5.8.1, `kubeconform -v` → v0.8.0
  - `--with-flutter` → 2분 46초, Flutter 3.47.7 / Dart 3.13.5, 재실행 2.6초(건너뜀).
    `pnpm mobile:analyze` → No issues found, `pnpm mobile:test` → 8개 통과, `pubspec.lock` 변경 없음
  - K8s: 저장소 그대로 실행하면 `secrets.env` 없음으로 실패하는데 파이프 종료 코드는 0 → 별도 이슈
    `2026-11-04-k8s-validation-false-pass`로 등록. 임시 복사본 + `pipefail`로 dev/prod 각 14/14 Valid
  - hook: 도구가 모두 있으면 출력 없음·exit 0, 없으면 누락 목록 출력·exit 0, 실행 시간 5ms 이내, 줄바꿈 없는 stdin도 정상
  - `pnpm format:check` → 통과
  - 실제 새 세션에서 hook이 실행되는지는 이 세션에서 확인할 수 없음 (**미검증**)
- 다음: (사용자) 환경 설정 Setup script에 README의 두 줄 추가 → 새 세션에서 hook 메시지와 `which kustomize kubeconform` 확인

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 착수하면서 설계를 바꿈. 완료 조건 전면 수정
  - 버린 안: SessionStart hook이 직접 설치. Claude Code는 SessionStart hook이 끝나야 첫 메시지를 읽기 때문에,
    무거운 다운로드를 hook에 넣으면 세션 시작이 그만큼 멈춘다
  - 고른 안: 설치 로직은 저장소의 `scripts/setup-toolchain.sh`에 두고(git으로 관리), 환경 setup script가 이를 호출한다.
    SessionStart hook은 설치 없이 도구 유무만 확인해서, setup script가 실패한 세션에서도 Agent가 누락 사실을 알게 한다
  - Flutter는 자동 설치에서 제외 (사용자 결정). SDK가 약 2GB라 새 세션 준비 시간이 늘어나기 때문.
    모바일 작업 때 `--with-flutter`로 직접 설치한다
  - 버전: kustomize 5.8.1(2026-02), kubeconform 0.8.0(2026-06), Flutter 3.47.7(2026-10-08, 기존 사용 버전).
    sha256은 각 프로젝트의 공식 체크섬 파일과 `releases_linux.json`에서 가져와 스크립트에 고정
- 검증: 다운로드 경로 접근 확인. `storage.googleapis.com` → 200, GitHub releases 파일 → 200.
  GitHub API(`api.github.com`)는 세션의 저장소 접근 정책으로 막혀 있어서, 버전은 릴리스 URL을 직접 조회해 확인함
- 다음: 스크립트 작성과 실행 검증

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 확인함
- 검증: `which flutter kustomize kubeconform kubectl` → 모두 없음
- 다음: 설치 경로 확인. 네트워크 정책상 GitHub releases와 storage.googleapis.com에 접근 가능한지 확인 필요
