---
id: 2026-11-04-restrict-health-detail-exposure
title: 외부에서 health 상세 정보(버전·메모리·지연시간) 노출 제한
status: done
priority: P1
area: [infra, server]
created: 2026-11-04
updated: 2026-11-05
---

# 외부에서 health 상세 정보 노출 제한

## 현재 상태

완료. 서버가 `HEALTH_EXPOSE_DETAILS`(운영 기본값 false)로 응답 범위를 정한다. 공개 응답은 `{status, checkedAt}` 까지만 담고,
전체 보고서는 서버 로그(WARN Readiness failed)에 남는다. web/mobile 진단 화면은 상세가 없으면 안내 문구를 보여준다.
Ingress 차단은 선택하지 않았다 (이유는 `docs/temp/decision-log.md`).

## 배경

`GET /api/v1/health`는 앱 버전, RSS 메모리, DB/Redis 지연시간과 장애 메시지를 누구에게나 응답한다.
공격자는 이걸로 버전을 특정하거나, 의존성 장애가 난 시점을 잡아 공격 시점을 고를 수 있다.
반대로 K8s probe와 내부 진단 화면(web `/health`, 모바일 health 화면)에는 이 정보가 필요하다.

## 완료 조건

- [x] 외부 Ingress 경로에서 `/api/v1/health`가 상세 정보를 주지 않음 (차단 또는 status만 응답). 방식은 작업 시작 시 결정해 로그에 기록
- [x] K8s readiness/liveness probe는 Pod에 직접 접근하므로 영향 없음을 확인
- [x] 로컬 Nginx(`infra/nginx/nginx.conf`)의 동작을 운영 설정과 맞추거나, 차이를 README에 명시
- [x] web/mobile 진단 화면이 바뀐 응답에서도 깨지지 않음 (테스트 또는 수동 확인 결과를 로그에)

## 범위 밖

- 인증된 관리자 전용 진단 API 신설

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 차단 방식을 "서버 측 응답 축소"로 결정하고 구현했다 (Ingress 경로 차단은 버림 — 근거는 판단 기록).
  - `packages/shared-types/src/health.ts`: `version`, `uptimeSeconds`, `components`, 컴포넌트별 수치를 모두 optional 로.
    와이어 계약이 "상세가 없을 수 있음"을 표현해야 클라이언트가 그 경우를 처리하도록 타입이 강제한다
  - `apps/server-api/src/config/env.validation.ts`: `HEALTH_EXPOSE_DETAILS` 추가 (기본 false)
  - `modules/health/health-report.redaction.ts`(신규): `redactHealthReport`, `redactLivenessResult`,
    그리고 내부 전용 타입 `FullHealthReport` / `FullLivenessResult`.
    `HealthService` 는 항상 전체를 만들고, 지우는 책임은 컨트롤러에만 둔다
  - `health.controller.ts`: 노출 범위 결정 + 실패 시 전체 보고서를 WARN 으로 로깅 (응답에서 지우더라도 운영자는 원인을 알아야 한다)
  - `health-check-failed.exception.ts`: `detail` 문구도 축약. 본문을 가렸는데 "Unhealthy components: redis" 로 흘리면 의미가 없다
  - web `health-dashboard.tsx`, mobile `health_report.dart` / `health_page.dart`: 상세 없는 응답 처리 + 안내 문구
  - `.env.example`·compose 는 true(로컬), `infra/k8s/base/backend-config.env` 는 false(운영). README·`CLAUDE.md` 2건 갱신
- 검증: 실제 Postgres·Redis 컨테이너를 띄우고 빌드된 서버를 실행해 네 경로를 확인했다
  - 기본값(상세 꺼짐)·정상: `data = {"status":"ok","checkedAt":...}`, HTTP 200. `/health/live` → `{"status":"ok"}`
  - `HEALTH_EXPOSE_DETAILS=true`·정상: version `9.9.9-test`, uptime, 컴포넌트별 latency·메모리 수치 포함, HTTP 200
  - 상세 켜짐 + Redis 중단: HTTP 503, `detail: "Unhealthy components: redis"`, `details` 에 전체 보고서
  - 기본값 + Redis 중단: HTTP 503, `detail: "The service is not ready to accept traffic."`,
    `details = {status, checkedAt}`. 서버 로그에는 `WARN [HealthController] Readiness failed: redis(unreachable)`
  - 상태 코드 의미(200/503)가 두 모드에서 동일 → K8s probe 는 영향 없음 (probe 는 Pod 에 직접 접근하고 상태 코드만 사용)
  - web `/health` 페이지를 상세 꺼진 서버에 붙여 렌더링: HTTP 200, "상세 정보를 공개하지 않습니다" 문구 표시,
    HTML 에 `9.9.9-test`·`rssBytes`·`latencyMs` 등장 횟수 0
  - `pnpm lint`(4/4), `pnpm typecheck`(5/5), `pnpm test` 17개 통과(축약 결과 검증 테스트 신규 4건 포함),
    `pnpm format:check` 통과, `pnpm mobile:analyze` 문제 0건, `pnpm mobile:test` 10개 통과(신규 2건 포함)
  - **미실행**: Docker 이미지 빌드. Alpine 패키지 저장소가 이 환경에서 막혀 있어
    (`dl-cdn.alpinelinux.org ... DNS: name does not exist`) compose 전체 기동으로는 확인하지 못했다.
    대신 DB·Redis 만 미러에서 받아 띄우고 서버·웹을 직접 실행해 검증했다
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 ID 체계를 날짜+slug로 바꾸면서 ID를 `ISSUE-0002` → `2026-11-04-restrict-health-detail-exposure`로 변경. `## 현재 상태` 섹션 추가
- 검증: `pnpm format:check` → 통과
- 다음: 없음 (이슈 내용 자체는 변경 없음)

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 최초 구축 보고의 "남은 위험 요소"에서 옮겨 옴
- 검증: 없음 (등록만 함)
- 다음: Ingress 차단과 서버 측 응답 축소 중 방식 결정
