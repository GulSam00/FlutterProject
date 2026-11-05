---
id: 2026-11-04-generate-dart-contract-models
title: Dart API 계약 모델을 손으로 옮기지 않고 생성하는 방식 검토
status: done
priority: P3
area: [mobile, shared, server]
created: 2026-11-04
updated: 2026-11-05
---

# Dart API 계약 모델 생성 방식 검토

## 현재 상태

완료. 코드 생성이 아니라 **드리프트 검사**(`pnpm check:contracts`)를 택했다.
Zod 스키마의 필드와 Dart 모델이 읽는 JSON 키를 비교해, 어긋나면 0이 아닌 코드로 실패한다.
검사를 만들면서 실제 드리프트 1건(ProblemDetails 의 `timestamp` 누락)을 발견해 고쳤다.

## 배경

API 계약의 원천은 `packages/shared-types`(TypeScript + Zod)다. 그런데 모바일의
`lib/core/network/api_response.dart`와 `features/*/domain` 모델은 이를 손으로 옮긴 사본이라,
필드가 바뀌어도 컴파일러가 차이를 잡지 못한다. 도메인이 늘어날수록 서버와 앱이 조용히 어긋날 위험이 커진다.

## 완료 조건

- [x] 후보 비교를 로그에 기록 (`docs/temp/decision-log.md`): NestJS OpenAPI + 코드 생성 / Zod → JSON Schema → 코드 생성 /
      **Zod → JSON Schema → 드리프트 검사**(선택) / 현행 유지
- [x] 선택한 방식으로 health 계약 검사가 동작하고 기존 Dart 테스트 통과.
      **코드 생성은 하지 않기로 했으므로 "모델 생성" 은 "검사 적용" 으로 대체** (근거는 판단 기록)
- [x] 계약이 어긋나면 실패하는 검사 1개: `pnpm check:contracts`.
      CI 에 연결하는 작업은 `2026-11-05-add-ci-pipeline` 에서 다룬다 (저장소에 CI 가 없다)

## 범위 밖

- 웹 클라이언트의 Zod 검증 방식 변경

## 변경 로그

### 2026-11-05 · claude/festive-franklin-pk7qxz

- 변경: 코드 생성 대신 드리프트 검사를 만들었다 (후보 비교와 근거는 판단 기록).
  - `packages/shared-types/src/dart-mirrors.ts`: `DART_MIRRORED_CONTRACTS` — Dart 사본이 있는 계약 7개 등록
  - `scripts/check-dart-contract.mjs`: 각 스키마를 `z.toJSONSchema(schema, { io: 'output' })` 로 변환해
    필드 이름을 얻고, 대응하는 Dart 클래스가 실제로 읽는 JSON 키(`'key':` 패턴 매칭과 `map['key']` 접근)를
    추출해 비교한다. 누락·잉여·미등록 계약을 모두 실패로 본다. 중첩 객체는 `path` 로 지정한다
  - `pnpm check:contracts` 스크립트, 루트·모바일 `CLAUDE.md` 안내, 생성기 템플릿에 등록 방법 주석
  - **실제 드리프트 수정**: 서버는 모든 problem+json 에 `timestamp` 를 보내는데 Dart `ProblemDetails` 가
    읽지 않고 버리고 있었다. 필드를 추가했다. 파싱은 `DateTime.tryParse` 로 한다 —
    에러 응답을 파싱하다 또 예외를 던지면 원래 에러의 원인이 가려진다
- 검증:
  - `node scripts/check-dart-contract.mjs` → 7개 일치, exit 0
    (ResponseMeta 3 · FieldError 2 · ProblemDetails 9 · DependencyHealth 3 · MemoryHealth 5 ·
    HealthCheckResult 5 · HealthCheckResult.components 3. LivenessResult 는 사본이 없어 건너뜀)
  - **효과 확인**: `HealthCheckResultSchema` 에 `region` 필드를 일부러 추가하니
    "Dart 가 읽지 않는 계약 필드 [region]" 으로 exit 1. 되돌린 뒤 다시 통과
  - 작성 중 거짓 양성 1건을 잡아 고쳤다: 클래스 본문을 "다음 class 선언까지" 로 자르면
    클래스 뒤의 최상위 함수(`_parseComponents`)가 섞여 그 함수의 키가 오인됐다 → 중괄호 짝을 세는 방식으로 변경
  - `pnpm mobile:analyze` 문제 0건, `pnpm mobile:test` 10개 통과
  - `pnpm lint`·`typecheck`·`test`·`format:check` 통과
  - `bash scripts/verify-scaffold.sh` 로 템플릿 재검증 (생성기 템플릿에 등록 안내를 추가했으므로)
- 다음: 없음

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 ID 체계를 날짜+slug로 바꾸면서 ID를 `ISSUE-0003` → `2026-11-04-generate-dart-contract-models`로 변경. `## 현재 상태` 섹션 추가
- 검증: `pnpm format:check` → 통과
- 다음: 없음 (이슈 내용 자체는 변경 없음)

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 계약 사본 문제를 구조적 부채로 등록
- 검증: 없음 (등록만 함)
- 다음: 도메인이 2~3개를 넘기 전에 착수
