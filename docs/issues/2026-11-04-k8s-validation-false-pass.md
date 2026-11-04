---
id: 2026-11-04-k8s-validation-false-pass
title: K8s 검증 명령이 실패해도 통과로 보이는 문제
status: todo
priority: P1
area: [infra]
created: 2026-11-04
updated: 2026-11-04
---

# K8s 검증 명령이 실패해도 통과로 보이는 문제

## 현재 상태

착수 전. 원인과 재현 방법은 확인했다.

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

- [ ] 검증을 스크립트 하나로 묶음 (예: `scripts/validate-k8s.sh`): `pipefail`, overlay별 실행, 리소스 0개면 실패
- [ ] `secrets.env`가 없으면 `secrets.env.example`을 임시 복사본에만 넣어 빌드 (작업 트리에 비밀 파일을 만들지 않음)
- [ ] 일부러 매니페스트를 깨뜨렸을 때 0이 아닌 코드로 실패함을 확인
- [ ] 루트 `CLAUDE.md`의 인프라 검증 명령을 새 스크립트로 교체
- [ ] dev/prod 모두 14/14 Valid 확인

## 범위 밖

- CI에 K8s 검증 추가

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. `2026-11-04-session-start-toolchain-hook` 검증 중 발견 (규칙 8)
- 검증: 저장소 그대로 `kustomize build infra/k8s/overlays/dev | kubeconform -strict -summary ...` →
  kustomize `secrets.env: no such file or directory` 오류, kubeconform `0 resource found`, 파이프 종료 코드 0 (kubeconform 기준).
  임시 복사본에 example을 넣고 `set -o pipefail`로 다시 실행 → dev/prod 각 14/14 Valid
- 다음: 검증 스크립트 작성
