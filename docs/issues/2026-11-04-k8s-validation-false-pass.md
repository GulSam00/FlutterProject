---
id: 2026-11-04-k8s-validation-false-pass
title: K8s 검증 명령이 실패해도 통과로 보이는 문제
status: done
priority: P1
area: [infra]
created: 2026-11-04
updated: 2026-11-05
---

# K8s 검증 명령이 실패해도 통과로 보이는 문제

## 현재 상태

완료. `scripts/validate-k8s.sh`가 검증을 담당한다. 거짓 통과 4경로(kustomize 실패 / 리소스 0개 / 스키마 위반 / 도구 없음)가
모두 0이 아닌 코드로 끝나는 것을 확인했다. 루트 `CLAUDE.md`와 README의 검증 명령도 교체했다.

## 배경

루트 `CLAUDE.md`의 인프라 검증 명령은 다음과 같다.

```bash
kustomize build infra/k8s/overlays/<dev|prod> | kubeconform -strict -summary -kubernetes-version 1.33.0
```

새로 clone한 저장소에서는 이 명령이 **실패했는데도 통과처럼 보인다.**

1. 각 overlay의 `secrets.env`는 `.gitignore` 대상이라 없다 (`secrets.env.example`만 있음).
   그래서 `kustomize build`가 실패한다.
2. kubeconform은 빈 입력을 받고 `0 resources found ... Valid: 0, Invalid: 0`을 출력한 뒤 **0으로 끝난다.**
3. `pipefail`이 없으면 파이프 전체의 종료 코드는 마지막 명령(kubeconform)의 0이다.

결국 매니페스트를 하나도 검증하지 않았는데 성공으로 끝난다. Agent가 이 결과를 이슈 로그에
"검증 통과"로 적으면, 로그의 검증 결과를 믿을 수 있다는 전제가 깨진다.

## 완료 조건

- [x] 검증을 스크립트 하나로 묶음 (예: `scripts/validate-k8s.sh`): `pipefail`, overlay별 실행, 리소스 0개면 실패
- [x] `secrets.env`가 없으면 `secrets.env.example`을 임시 복사본에만 넣어 빌드 (작업 트리에 비밀 파일을 만들지 않음)
- [x] 일부러 매니페스트를 깨뜨렸을 때 0이 아닌 코드로 실패함을 확인
- [x] 루트 `CLAUDE.md`의 인프라 검증 명령을 새 스크립트로 교체
- [x] dev/prod 모두 14/14 Valid 확인

## 범위 밖

- CI에 K8s 검증 추가

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: `scripts/validate-k8s.sh` 추가. kustomize 와 kubeconform 을 파이프로 잇지 않고 단계별로 실행하고,
  각 단계 실패 · 렌더링 리소스 0개 · 도구 없음을 모두 실패로 처리한다. `secrets.env` 가 없으면 `secrets.env.example` 을
  임시 복사본에만 복사해 렌더링하므로 작업 트리에는 비밀 파일이 생기지 않는다. 렌더링 결과도 임시 디렉터리에만 두고 종료 시 지운다.
  루트 `CLAUDE.md` 검증 절과 README "4. Kubernetes 배포" 의 명령을 이 스크립트로 교체하고, 파이프를 직접 쓰지 말라는 경고를 남겼다.
- 검증:
  - `bash -n scripts/validate-k8s.sh` → 통과
  - 정상: `secrets.env` 없는 상태에서 `bash scripts/validate-k8s.sh` → dev 14/14 Valid, prod 14/14 Valid, exit 0.
    실행 후 `ls infra/k8s/overlays/*/secrets.env` → 없음 (작업 트리 오염 없음), `git status --short infra` → 변경 없음
  - 실패 A: base `resources` 에 없는 파일 추가 → "kustomize build 실패", exit 1
  - 실패 B: `resources: []` overlay (빌드는 성공하고 출력 0바이트) → "렌더링된 리소스가 0개입니다", exit 1
  - 실패 C: Deployment `spec` 에 스키마에 없는 필드 추가 → kubeconform Invalid 1, "kubeconform 검증 실패", exit 1
  - 실패 D: `PATH` 에서 도구 제거 → "필요한 도구가 없습니다: kustomize kubeconform", exit 1
  - `pnpm format:check` → 통과
  - 참고: A·B 를 처음 테스트할 때는 각각 `images` 목록 파싱 오류와 "kustomization.yaml is empty" 로 실패해서
    의도한 경로를 지나지 않았다. 원인을 고쳐 다시 테스트한 결과가 위 내용이다
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. `2026-11-04-session-start-toolchain-hook` 검증 중 발견 (규칙 8)
- 검증: 저장소 그대로 `kustomize build infra/k8s/overlays/dev | kubeconform -strict -summary ...` →
  kustomize `secrets.env: no such file or directory` 오류, kubeconform `0 resource found`, 파이프 종료 코드 0 (kubeconform 기준).
  임시 복사본에 example을 넣고 `set -o pipefail`로 다시 실행 → dev/prod 각 14/14 Valid
- 다음: 검증 스크립트 작성
