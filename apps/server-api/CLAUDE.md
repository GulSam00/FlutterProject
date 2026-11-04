# server-api 규칙

공통 규칙(API 계약, 금지 사항, 이슈 절차)은 루트 `CLAUDE.md`에 있다. 여기에는 이 앱에서만 통하는 규칙을 둔다.

## 명령

- 테스트: `pnpm --filter @app/server-api test` (spec 파일은 대상 파일 옆에 `*.spec.ts`로 둔다)
- 로컬 실행: `pnpm infra:up` (Postgres, Redis) → `pnpm --filter @app/server-api dev`
- 마이그레이션 생성: `pnpm infra:up` 후
  `pnpm --filter @app/server-api migration:generate src/infrastructure/database/migrations/<PascalName>`
  - 스크립트가 먼저 빌드하고 `dist` 기준으로 실행한다. 빌드가 깨져 있으면 마이그레이션 생성도 실패한다.
  - 실행 중인 DB 스키마와 비교해서 만든다. DB가 없으면 생성할 수 없다.

## 도메인 모듈 구조

```
src/modules/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts    # HTTP 입출력만. 비즈니스 판단 금지
├── <domain>.service.ts       # 비즈니스 규칙. HTTP 객체(Request/Response)를 모른다
├── <domain>.repository.ts    # TypeORM Repository<T>를 주입받아 감싼다. 쿼리는 여기에만
├── dto/*.dto.ts
└── entities/*.entity.ts      # 반드시 이 폴더 (아래 "엔티티" 참조)
```

- 아직 이 구조를 따르는 참고 구현이 없다. `health` 모듈은 저장소 계층이 없는 예외 모듈이니 따라 하지 않는다.
  참고 구현은 `docs/issues/2026-11-04-domain-scaffold-generator.md`에서 생성기 템플릿으로 만든다.
- Data Mapper 패턴만 쓴다. 엔티티에 `save()` 같은 메서드를 붙이는 Active Record 방식은 쓰지 않는다.

## 엔티티

- **엔티티 파일은 반드시 `modules/<domain>/entities/*.entity.ts`에 둔다.**
  앱 런타임은 `forFeature()`로 등록된 엔티티를 쓰지만, 마이그레이션 CLI(`data-source.ts`)는 이 경로 패턴으로만 찾는다.
  다른 위치에 두면 앱은 정상 동작하는데 `migration:generate`가 빈 마이그레이션을 만든다. 그러면 운영 DB에 테이블이 생기지 않는다.
- `infrastructure/database/base.entity.ts`의 `BaseEntity`를 상속한다 (uuid, 생성·수정 시각, soft delete, 낙관적 잠금 version).
- 엔티티를 API 응답으로 그대로 반환하지 않는다. 응답용 DTO로 바꿔서 내보낸다 (내부 컬럼 노출과 계약 결합 방지).

## DTO와 검증

- 요청 DTO의 **모든 필드에 class-validator 데코레이터가 필요하다.**
  `forbidNonWhitelisted: true`라서 데코레이터가 없는 필드를 보낸 요청은 400으로 거부된다.
- `enableImplicitConversion: false`다. 쿼리 문자열 숫자 등은 `@Type(() => Number)`로 명시적으로 변환한다.

## 에러

- 의도한 실패는 `common/exceptions/problem.exception.ts`의 `ProblemException` 계열로 던진다.
  도메인별 예외는 이를 상속해 만든다 (`modules/health/health-check-failed.exception.ts`가 예시).
- `QueryFailedError`의 unique(23505)·FK(23503) 위반은 필터가 409로 바꾼다. 서비스에서 같은 변환을 반복하지 않는다.

## 외부 의존성

- Redis는 `REDIS_CLIENT` 토큰으로 주입받는다. `enableOfflineQueue: false`라서 **연결이 끊기면 명령이 즉시 실패한다.**
  호출하는 쪽에서 실패 처리(캐시 미스로 취급하는 등)를 반드시 정한다. 조용히 쌓였다가 한꺼번에 실행되는 일은 없다.
- 외부 호출에는 `common/utils/with-timeout.ts`로 타임아웃을 건다.
- readiness(`/health`)에 의존성을 추가하면, 그 의존성이 죽을 때 **모든 Pod가 트래픽에서 빠진다.**
  없어도 일부 기능이 동작하는 의존성은 readiness에 넣지 않는다.

## 환경변수 추가 시 함께 고칠 곳

1. `src/config/env.validation.ts` (`EnvironmentVariables` 클래스에 검증 데코레이터와 함께)
2. `.env.example`
3. `infra/docker/docker-compose.local.yml`의 `server-api.environment`
4. K8s: 비밀이 아니면 `infra/k8s/base/backend-config.env`, 비밀이면 `infra/k8s/overlays/*/secrets.env.example`

1번만 고치면 로컬은 동작하지만, 컨테이너와 K8s에서는 부팅 검증에 실패해 Pod가 뜨지 않는다.
