---
id: ISSUE-0003
title: Dart API 계약 모델을 손으로 옮기지 않고 생성하는 방식 검토
status: todo
priority: P3
area: [mobile, shared, server]
created: 2026-11-04
updated: 2026-11-04
---

# ISSUE-0003: Dart API 계약 모델 생성 방식 검토

## 배경

API 계약의 원천은 `packages/shared-types`(TypeScript + Zod)다. 그런데 모바일의
`lib/core/network/api_response.dart`와 `features/*/domain` 모델은 이를 손으로 옮긴 사본이라,
필드가 바뀌어도 컴파일러가 차이를 잡지 못한다. 도메인이 늘어날수록 서버와 앱이 조용히 어긋날 위험이 커진다.

## 완료 조건

- [ ] 후보 비교를 로그에 기록: NestJS OpenAPI 스펙 내보내기 + Dart 코드 생성 / Zod → JSON Schema → Dart / 현행 유지
- [ ] 선택한 방식으로 health 모델을 생성해 기존 Dart 테스트 통과
- [ ] 계약이 어긋나면 CI에서 실패하는 검사 1개 이상

## 범위 밖

- 웹 클라이언트의 Zod 검증 방식 변경

## 변경 로그

### 2026-11-04 · claude/festive-franklin-pk7qxz

- 변경: 이슈 생성. 계약 사본 문제를 구조적 부채로 등록
- 검증: 없음 (등록만 함)
- 다음: 도메인이 2~3개를 넘기 전에 착수
