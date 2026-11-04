---
id: 2026-11-04-session-start-toolchain-hook
title: 클라우드 세션 시작 시 검증 도구 자동 설치 (Flutter, kustomize, kubeconform)
status: todo
priority: P2
area: [infra, mobile]
created: 2026-11-04
updated: 2026-11-04
---

# 클라우드 세션 시작 시 검증 도구 자동 설치

## 현재 상태

착수 전.

## 배경

루트 `CLAUDE.md`의 "검증" 절차는 `flutter`, `kustomize`, `kubeconform`이 필요하다.
그런데 클라우드 세션 컨테이너는 매번 새로 만들어지고, 이 도구들이 기본으로 없다.
그 결과 새 세션은 다음 둘 중 하나가 된다.

- 매번 도구를 수동으로 설치하느라 시간을 쓴다.
- 설치하지 않고 검증을 건너뛴다. 가장 위험한 경우는 실패한 명령을 무시하고 "검증 완료"로 기록하는 것이다.

## 완료 조건

- [ ] SessionStart hook(`.claude/settings.json`)이 `pnpm install`과 도구 설치를 수행
- [ ] 버전을 고정함 (Flutter 3.47.x, kubeconform, kustomize). 설치 실패 시 세션에 명확한 메시지 출력
- [ ] 이미 설치되어 있으면 건너뜀 (세션 시작이 느려지지 않게)
- [ ] 새 세션에서 `pnpm mobile:analyze`와 `kustomize build ... | kubeconform`이 바로 실행됨을 확인
- [ ] `apps/client-mobile/CLAUDE.md`의 "Flutter SDK가 기본으로 없다" 문장 교체

## 범위 밖

- 로컬 개발자 PC의 도구 설치 안내 (README에 있음)

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 앱별 CLAUDE.md 검토 중 확인함
- 검증: `which flutter kustomize kubeconform kubectl` → 모두 없음
- 다음: 설치 경로 확인. 네트워크 정책상 GitHub releases와 storage.googleapis.com에 접근 가능한지 확인 필요
