# Fullstack Boilerplate

**Flutter (Mobile) · Next.js (Web) · NestJS (API) · PostgreSQL · Redis · Turborepo · Docker / Kubernetes**

특정 도메인에 종속되지 않는 프로덕션 수준의 풀스택 뼈대입니다. 회원/결제 같은 도메인 로직은 의도적으로 포함하지 않았으며,
`modules/<domain>`(서버) · `features/<domain>`(웹/모바일) 단위로 새 도메인을 바로 얹을 수 있게 설계했습니다.

---

## 1. 디렉토리 구조

```
.
├── apps/
│   ├── client-mobile/        # Flutter (Riverpod AsyncNotifier + Dio) — pnpm 워크스페이스 밖 (pubspec 관리)
│   ├── client-web/           # Next.js 15 App Router + TanStack Query v5 + Tailwind v4
│   └── server-api/           # NestJS 11 — Controller → Service → Repository(Indicator)
├── packages/
│   ├── shared-types/         # Zod 스키마 = 단일 진실 공급원(SSOT). Web/Server 공용 DTO·응답 규격
│   ├── eslint-config/        # ESLint 9 flat config (type-aware, no-explicit-any = error)
│   └── tsconfig/             # strict 베이스 + nestjs / nextjs / library 프리셋
├── infra/
│   ├── docker/               # docker-compose.local.yml, Dockerfile.server, Dockerfile.web
│   ├── nginx/                # nginx.conf + snippets/proxy-common.conf
│   └── k8s/                  # Kustomize base/ + overlays/{dev,prod}
├── turbo.json                # 태스크 그래프 & 캐싱 정책
└── pnpm-workspace.yaml
```

### 요청 흐름

```
Browser ──► Nginx(:80) ─┬─ Host: web.local.dev ──► client-web:3001 ──(RSC, 내부 DNS)──┐
                        └─ Host: api.local.dev ──► server-api:3000 ◄───────────────────┘
Flutter ──► Nginx(:8080, Host 무관) ──────────────► server-api:3000 ──► PostgreSQL / Redis
```

### 공통 API 계약 (`@repo/shared-types`)

| 구분 | 형식                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 성공 | `{ "success": true, "data": T, "meta": { "timestamp", "requestId", "path" } }`                                  |
| 실패 | RFC 7807 `application/problem+json` — `{ type, title, status, detail, instance, requestId, errors?, details? }` |

- 모든 요청은 `X-Request-ID`로 추적됩니다 (Nginx 생성 → NestJS 재사용 → 응답 헤더/에러 바디/로그에 동일 값).
- Web(TS)은 Zod로, Mobile(Dart)은 패턴 매칭으로 **응답을 런타임 검증**합니다. 계약이 깨지면 `undefined` 렌더링 대신 명시적 에러가 납니다.

---

## 2. 사전 요구사항

| 도구           | 버전                    | 비고                                      |
| -------------- | ----------------------- | ----------------------------------------- |
| Node.js        | ≥ 22.12 (`.nvmrc`)      |                                           |
| pnpm           | 10.x (`packageManager`) | `corepack enable` 또는 `npm i -g pnpm@10` |
| Docker Compose | v2                      |                                           |
| Flutter        | ≥ 3.35 (Dart ≥ 3.9)     | 모바일 작업 시                            |

`/etc/hosts`에 로컬 도메인을 등록합니다.

```bash
echo "127.0.0.1 api.local.dev web.local.dev" | sudo tee -a /etc/hosts
```

### Claude 클라우드 세션 설정

클라우드 세션은 매번 새 컨테이너에서 시작해서 kustomize, kubeconform이 없습니다.
claude.ai 환경 설정(세션 제목 표시줄의 클라우드 환경 메뉴 → Edit → **Setup script**)에 아래 두 줄을 넣으면,
새 컨테이너를 만들 때 한 번 설치됩니다. setup script는 저장소의 상위 디렉터리에서 시작하므로 `cd`가 먼저 필요합니다.

```bash
if [ -d FlutterProject ]; then
  cd FlutterProject
  bash scripts/setup-toolchain.sh
fi
```

> ⚠️ `if [ -d ... ]` 로 감싸는 이유: 하나의 환경을 여러 저장소가 공유하면, Setup script 는 모든 세션에서 실행됩니다.
> 감싸지 않으면 다른 저장소의 세션에서 `cd: No such file or directory` 로 **스크립트 전체가 실패**하고,
> 그 세션은 설정되지 않은 컨테이너로 시작합니다. 같은 이유로 다른 프로젝트의 명령도 각각 감싸 두세요.

- 설치 로직과 고정 버전·sha256은 `scripts/setup-toolchain.sh`에 있습니다 (환경 설정에는 호출만 둡니다).
- Flutter SDK(약 2GB)는 세션 준비 시간을 줄이려고 기본 설치에서 뺐습니다. 모바일 작업 때 세션 안에서
  `bash scripts/setup-toolchain.sh --with-flutter`를 실행하세요 (약 3분).
- 세션이 시작될 때 `.claude/settings.json`의 SessionStart hook(`scripts/check-toolchain.sh`)이 도구 유무만 확인하고,
  빠진 것이 있으면 알려줍니다. 이 hook은 아무것도 설치하지 않습니다.

---

## 3. 로컬 실행 및 검증 가이드 (Step-by-Step)

### Step 1) 모노레포 패키지 설치 및 빌드

```bash
pnpm install                 # 워크스페이스 전체 의존성 (lockfile 기준)
pnpm build                   # shared-types → server-api / client-web 순서로 위상 정렬 빌드
pnpm lint && pnpm typecheck && pnpm test
```

- `turbo.json`의 `"dependsOn": ["^build"]` 때문에 `@repo/shared-types`가 항상 먼저 빌드됩니다.
- 같은 명령을 다시 실행하면 `FULL TURBO`(전부 캐시 히트)로 수백 ms 안에 끝나야 정상입니다.
  (실측: 콜드 약 76초 → 웜 355ms)

> **호스트에서 개발 서버로 띄우고 싶다면**: `pnpm infra:up`으로 DB/Redis만 컨테이너로 올리고,
> `apps/server-api/.env.example` → `.env`, `apps/client-web/.env.example` → `.env.local` 복사 후 `pnpm dev`.
> (`.env`의 비밀번호를 `infra/docker/.env`와 맞출 것)

### Step 2) Docker Compose 기반 인프라 구동

```bash
cp infra/docker/.env.example infra/docker/.env   # 비밀번호 변경 권장
pnpm docker:up                                   # = docker compose ... up -d --build
docker compose -f infra/docker/docker-compose.local.yml --env-file infra/docker/.env ps
```

기대 결과 — 5개 서비스가 모두 `healthy`:

```
postgres    Up (healthy)
redis       Up (healthy)
server-api  Up (healthy)
client-web  Up (healthy)
nginx       Up (healthy)   0.0.0.0:80->80, 0.0.0.0:8080->8080
```

기동 순서는 `depends_on.condition: service_healthy`로 강제됩니다:
`postgres/redis(healthy)` → `server-api(healthy)` → `client-web(healthy)` → `nginx`.

### Step 3) Nginx 프록시를 통한 통신 검증

아래 순서대로 확인합니다. (각 단계가 앞 단계의 정상을 전제로 하므로 순서가 중요합니다)

```bash
# 3-1. 엣지 자체 생존 확인
curl -s http://127.0.0.1/nginx-health                         # → ok

# 3-2. 정의되지 않은 Host 차단 (444 = 응답 없이 연결 종료, curl exit 52)
curl -s -H 'Host: evil.com' http://127.0.0.1/; echo "exit=$?"  # → exit=52

# 3-3. API Liveness (의존성 무관)
curl -s http://api.local.dev/api/v1/health/live
# → {"success":true,"data":{"status":"ok","uptimeSeconds":..},"meta":{...}}

# 3-4. API Readiness (DB + Redis + Memory)
curl -s -i http://api.local.dev/api/v1/health
# → HTTP/1.1 200, data.components.{database,redis,memory}.status = "up"
#   (로컬 compose 는 HEALTH_EXPOSE_DETAILS=true. 운영 기본값 false 에서는 data = {status, checkedAt} 만 온다)

# 3-5. 요청 ID 전파
curl -s -D - -o /dev/null -H 'X-Request-ID: trace-0001-abcd' http://api.local.dev/api/v1/health/live | grep -i x-request-id
# → X-Request-ID: trace-0001-abcd

# 3-6. CORS (web → api)
curl -s -i -X OPTIONS -H 'Origin: http://web.local.dev' -H 'Access-Control-Request-Method: GET' \
  http://api.local.dev/api/v1/health | grep -i access-control-allow-origin
# → Access-Control-Allow-Origin: http://web.local.dev

# 3-7. Web 진단 페이지 (SSR 로 데이터가 HTML 에 이미 포함되어야 함)
open http://web.local.dev/health
```

**장애 시나리오 검증** (운영에서 실제로 마주칠 상황을 미리 재현):

```bash
COMPOSE="docker compose -f infra/docker/docker-compose.local.yml --env-file infra/docker/.env"

# Redis 장애 → readiness 503 + 어떤 컴포넌트가 문제인지 명시
$COMPOSE stop redis
curl -s http://api.local.dev/api/v1/health
# → {"type":"urn:problem-type:service-unavailable","status":503,"detail":"Unhealthy components: redis","details":{...}}
#   운영 기본값(HEALTH_EXPOSE_DETAILS=false)에서는 detail 이 "The service is not ready to accept traffic." 이고
#   details 에도 {status, checkedAt} 만 담긴다. 어떤 의존성이 왜 실패했는지는 서버 로그(WARN Readiness failed)에서 본다
$COMPOSE start redis

# API 장애 → Nginx 가 HTML 502 대신 RFC 7807 JSON 503 반환, 웹 페이지 셸은 200 유지
$COMPOSE stop server-api
curl -s -i http://api.local.dev/api/v1/health      # → 503 application/problem+json
curl -s -o /dev/null -w "%{http_code}\n" http://web.local.dev/health   # → 200
$COMPOSE start server-api
```

### Step 4) Flutter 앱 연결

```bash
cd apps/client-mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080     # Android 에뮬레이터
flutter run --dart-define=API_BASE_URL=http://localhost:8080    # iOS 시뮬레이터
flutter analyze && flutter test                                 # 또는 루트에서 pnpm mobile:analyze / mobile:test
```

- Nginx `:8080`은 Host 헤더와 무관하게 API로 라우팅됩니다. Android 에뮬레이터는 호스트의 `/etc/hosts`를 쓰지 못하기 때문입니다.
- 실기기에서 호스트 IP(예: `192.168.0.10`)로 접속하려면 `android/app/src/debug/res/xml/network_security_config.xml`에 해당 IP를 추가하세요. (cleartext HTTP는 debug 빌드에서만 허용)

### 정리

```bash
pnpm docker:down        # 컨테이너 종료 (볼륨 유지)
$COMPOSE down -v        # 데이터 볼륨까지 삭제
```

---

## 4. Kubernetes 배포 (Phase 3)

```bash
# 매니페스트 검증 (배포 전에 먼저 실행). secrets.env 가 없으면 example 을 임시 복사본에만 넣어 렌더링한다.
bash scripts/validate-k8s.sh              # dev prod 둘 다 / 특정 overlay 만: validate-k8s.sh dev

cp infra/k8s/overlays/dev/secrets.env.example infra/k8s/overlays/dev/secrets.env   # 커밋 금지(.gitignore)
kubectl kustomize infra/k8s/overlays/dev              # 렌더링 결과 확인
kubectl apply -k infra/k8s/overlays/dev
kubectl -n app-dev rollout status deploy/server-api
```

> ⚠️ 검증은 반드시 `scripts/validate-k8s.sh`로 하세요. `kustomize build ... | kubeconform ...` 파이프는
> `secrets.env`가 없을 때 kustomize가 실패하는데도 kubeconform이 "0 resources"로 성공 코드를 내서 거짓 통과합니다.

| 리소스             | 핵심 설정                                                   | 예방하는 운영 리스크                                   |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| Deployment         | `maxUnavailable: 0`, `maxSurge: 25%`, `minReadySeconds: 10` | 롤링 업데이트 중 용량 감소 / 부팅 직후 죽는 버전 확산  |
| Deployment         | `replicas` 미지정                                           | `kubectl apply` 시 HPA가 늘린 레플리카가 리셋되는 문제 |
| startupProbe       | `/health/live`, 최대 120s                                   | 느린 부팅을 "죽음"으로 오판한 재시작 루프              |
| livenessProbe      | `/health/live` (의존성 체크 **없음**)                       | DB 장애 시 전체 Pod 동시 재시작(장애 증폭)             |
| readinessProbe     | `/health` (DB·Redis·Memory), timeout 3s > 앱 내부 1.5s      | 의존성 장애 Pod를 재시작 없이 트래픽에서만 제외        |
| preStop            | `sleep 10`                                                  | Endpoint 제거 전파 전 종료 → 롤링 중 간헐적 502        |
| securityContext    | non-root, readOnlyRootFilesystem, drop ALL, seccomp         | 컨테이너 탈취 시 권한 상승·코드 변조                   |
| HPA                | CPU 70%, scaleDown 안정화 300s                              | 포화 후 늦은 확장 / flapping                           |
| configMapGenerator | 이름에 내용 해시                                            | 설정 변경이 Pod에 반영되지 않는 문제                   |
| NetworkPolicy      | default-deny + 명시적 허용                                  | 클러스터 내 횡적 이동(lateral movement)                |

> ⚠️ 커뮤니티 **ingress-nginx는 2026년 3월 유지보수가 종료**되었습니다. `ingress.yaml`은 표준 `networking.k8s.io/v1`이므로
> Gateway API 또는 유지되는 NGINX 구현체로 교체 시 annotation만 바꾸면 됩니다.
>
> DB 마이그레이션은 다중 레플리카 경합을 피하기 위해 `DB_RUN_MIGRATIONS=false`로 두고, 배포 파이프라인에서 별도 Job으로 실행하세요.

---

## 5. 새 도메인 추가 체크리스트

1. **계약 정의** — `packages/shared-types/src/<domain>.ts`에 Zod 스키마 작성 후 `index.ts`에서 re-export
2. **서버** — `apps/server-api/src/modules/<domain>/`
   - `entities/*.entity.ts` (`infrastructure/database/base.entity.ts` 상속, Data Mapper)
   - `<domain>.repository.ts` (TypeORM `Repository<T>` 캡슐화) → `<domain>.service.ts` → `<domain>.controller.ts`
   - 요청 DTO는 `class-validator`, 의도된 에러는 `ProblemException` 상속
   - `app.module.ts`의 Feature modules에 등록, `pnpm --filter @app/server-api migration:generate src/infrastructure/database/migrations/<Name>`
3. **웹** — `apps/client-web/src/features/<domain>/{api,components}` (`queryOptions` 팩토리 + Query Key Factory)
4. **모바일** — `apps/client-mobile/lib/features/<domain>/{data,domain,presentation}`

---

## 6. 설계 결정과 알려진 트레이드오프

- **의존성 메이저 버전 고정**: Next 15 / NestJS 11 / TypeORM 0.3 / ESLint 9 / TS 5.9 — 이미 검증된 메이저에서 최신 패치를 사용합니다.
  더 새로운 메이저(Next 16, Nest 12, TypeORM 1.x 등)는 마이그레이션 가이드를 검토한 뒤 Renovate 등으로 올리세요.
- **`NEXT_PUBLIC_*`는 빌드 타임 상수**입니다. 환경마다 이미지를 따로 빌드해야 합니다(turbo 캐시 키에도 포함됨).
- **헬스 상세 정보 노출**: `/api/v1/health`는 버전·지연시간·메모리를 반환합니다. 공개 인터넷에서는 Ingress/WAF에서 내부망으로 제한하는 것을 권장합니다.
- **Readiness에 DB 포함**: DB 장애 시 모든 Pod가 NotReady가 되어 전체가 503이 됩니다. DB 없이 동작 가능한 엔드포인트가 많아지면 readiness 판정 기준을 재검토하세요.
- **Flutter는 Turborepo 파이프라인 밖**: Flutter SDK가 없는 CI/Docker 빌드가 깨지지 않도록 분리했습니다. 루트의 `pnpm mobile:*` 스크립트를 사용하세요.
