# client-mobile 규칙

공통 규칙(API 계약, 금지 사항, 이슈 절차)은 루트 `CLAUDE.md`에 있다. 여기에는 이 앱에서만 통하는 규칙을 둔다.

## 명령

- 이 앱은 pnpm 워크스페이스와 turbo 파이프라인 밖에 있다. `pnpm lint` / `pnpm test`에 포함되지 않는다.
- 정적 분석: `pnpm mobile:analyze` · 테스트: `pnpm mobile:test` · 포맷: `cd apps/client-mobile && dart format .`
- 클라우드 세션에서는 Flutter SDK를 자동으로 설치하지 않는다 (세션 준비 시간 때문에 의도한 기본값).
  모바일 검증이 필요하면 먼저 `bash scripts/setup-toolchain.sh --with-flutter`를 실행한다 (고정 버전 3.47.7, 약 3분).
  설치할 수 없으면 실행한 것처럼 기록하지 말고 "검증 미실행: flutter 없음"으로 남긴다.
- 실행: `flutter run --dart-define=API_BASE_URL=<주소>`
  - 기본값 `http://10.0.2.2:8080`은 Android 에뮬레이터 전용 주소(호스트 PC)다. iOS 시뮬레이터는 `http://localhost:8080`.
  - `:8080`은 Host 헤더 없이 API로 가는 Nginx 포트다. 에뮬레이터에서 `api.local.dev` 도메인을 쓸 수 없어서 따로 두었다.

## 구조

```
lib/
├── core/                         # 도메인을 모르는 공통 기반 (network, auth, config, observability)
└── features/<name>/
    ├── domain/                   # 모델. fromJson으로 구조를 검증한다
    ├── data/<name>_repository.dart
    └── presentation/             # AsyncNotifier 컨트롤러 + 화면
```

## 네트워크

- HTTP 호출은 `dioClientProvider`(`core/network/dio_client.dart`)의 `DioClient`로만 한다.
  `Dio()`를 직접 만들면 인증·에러 인터셉터를 건너뛴다.
  예외는 `createDio` 안의 토큰 재발급·재시도용 Dio뿐이다 (인터셉터 교착 방지용으로 의도한 것).
- 모델의 `fromJson(Object? json)`은 패턴 매칭으로 구조를 검증하고, 맞지 않으면 `FormatException`을 던진다.
  `DioClient`가 이를 `ContractViolationException`으로 바꾼다. 형식이 틀린 데이터를 null이나 기본값으로 덮지 않는다.

## 계약 사본

- `core/network/api_response.dart` 와 `features/*/domain` 의 모델은 `@repo/shared-types` 의 Zod 스키마를
  손으로 옮긴 사본이다. 고친 뒤 `pnpm check:contracts` 로 어긋남을 확인한다.
- 새 모델을 추가하면 `packages/shared-types/src/dart-mirrors.ts` 와
  `scripts/check-dart-contract.mjs` 의 `MIRRORS` 에 등록한다. 등록하지 않으면 검사 대상에서 빠진다
  (검사가 "등록되지 않은 계약" 도 실패로 보고한다).

## 상태와 에러

- 상태 관리는 `AsyncNotifier` + `AsyncNotifierProvider.autoDispose`를 쓴다. `StateNotifier`, `ChangeNotifier`는 쓰지 않는다.
- 에러는 sealed `ApiException`(`core/network/api_exception.dart`)을 **exhaustive switch**로 처리한다.
  `default:`나 `_`로 묶으면, 하위 타입이 추가됐을 때 컴파일러가 처리 누락을 알려주지 못한다.

## 인증

- `core/network/interceptors/auth_interceptor.dart`를 고치면
  `test/core/network/interceptors/auth_interceptor_test.dart`의 세 시나리오가 모두 통과해야 한다.
  1. 동시에 401이 여러 번 와도 refresh는 한 번만 호출 (single-flight)
  2. refresh가 401이면 세션 만료
  3. refresh가 네트워크 오류면 토큰 유지 (일시 장애로 로그아웃 금지)

## 플랫폼 설정

- HTTP 평문 통신 허용은 디버그 빌드에만 둔다 (`android/app/src/debug/`의 network security config).
  release 매니페스트에 넣지 않는다.
