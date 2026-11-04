---
id: 2026-11-04-restrict-health-detail-exposure
title: 외부에서 health 상세 정보(버전·메모리·지연시간) 노출 제한
status: todo
priority: P1
area: [infra, server]
created: 2026-11-04
updated: 2026-11-04
---

# 외부에서 health 상세 정보 노출 제한

## 현재 상태

착수 전. 차단 방식(Ingress 경로 차단 vs 서버 응답 축소)을 아직 정하지 않았다.

## 배경

`GET /api/v1/health`는 앱 버전, RSS 메모리, DB/Redis 지연시간과 장애 메시지를 누구에게나 응답한다.
공격자는 이걸로 버전을 특정하거나, 의존성 장애가 난 시점을 잡아 공격 시점을 고를 수 있다.
반대로 K8s probe와 내부 진단 화면(web `/health`, 모바일 health 화면)에는 이 정보가 필요하다.

## 완료 조건

- [ ] 외부 Ingress 경로에서 `/api/v1/health`가 상세 정보를 주지 않음 (차단 또는 status만 응답). 방식은 작업 시작 시 결정해 로그에 기록
- [ ] K8s readiness/liveness probe는 Pod에 직접 접근하므로 영향 없음을 확인
- [ ] 로컬 Nginx(`infra/nginx/nginx.conf`)의 동작을 운영 설정과 맞추거나, 차이를 README에 명시
- [ ] web/mobile 진단 화면이 바뀐 응답에서도 깨지지 않음 (테스트 또는 수동 확인 결과를 로그에)

## 범위 밖

- 인증된 관리자 전용 진단 API 신설

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 ID 체계를 날짜+slug로 바꾸면서 ID를 `ISSUE-0002` → `2026-11-04-restrict-health-detail-exposure`로 변경. `## 현재 상태` 섹션 추가
- 검증: `pnpm format:check` → 통과
- 다음: 없음 (이슈 내용 자체는 변경 없음)

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 최초 구축 보고의 "남은 위험 요소"에서 옮겨 옴
- 검증: 없음 (등록만 함)
- 다음: Ingress 차단과 서버 측 응답 축소 중 방식 결정
