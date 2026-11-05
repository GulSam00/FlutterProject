import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** "true"/"1" → true. 환경변수는 항상 문자열이므로 Boolean("false") === true 함정을 피한다. */
const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value,
  );

/** "a, b ,c" → ['a','b','c'] */
const ToStringArray = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      : value,
  );

/**
 * 부팅 시점(Fail-fast) 환경변수 검증.
 *
 * 운영 리스크: 환경변수 오타/누락이 있으면 "첫 요청이 들어온 순간" 터지는 것이 최악이다.
 * 여기서 검증에 실패하면 프로세스가 즉시 종료되고, k8s 는 새 Pod 를 Ready 로 만들지 않으므로
 * RollingUpdate 가 중단되어 기존 정상 Pod 가 트래픽을 계속 처리한다.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  APP_VERSION = '0.0.0';

  @ToStringArray()
  @IsString({ each: true })
  CORS_ORIGINS: string[] = [];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS = 1;

  // ── PostgreSQL ─────────────────────────────
  @IsString()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  DB_PORT = 5432;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  @MinLength(1)
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @ToBoolean()
  @IsBoolean()
  DB_SSL = false;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  DB_POOL_MAX = 10;

  @ToBoolean()
  @IsBoolean()
  DB_RUN_MIGRATIONS = false;

  // ── Health ─────────────────────────────────
  /**
   * `/health` 응답에 상세 정보(버전, uptime, 의존성 지연시간, 메모리 수치)를 포함할지.
   *
   * 기본값 false: 이 엔드포인트는 인증이 없고 외부에 노출된다. 상세 정보를 흘리면 공격자가
   * 버전을 특정하거나 의존성이 흔들리는 시점을 골라 공격할 수 있다. K8s probe 는 상태 코드만 쓰므로 영향이 없다.
   * 로컬·dev 처럼 신뢰된 환경에서만 true 로 켠다.
   */
  @ToBoolean()
  @IsBoolean()
  HEALTH_EXPOSE_DETAILS = false;

  // ── Redis ──────────────────────────────────
  @IsString()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsInt()
  REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  REDIS_DB = 0;

  @IsString()
  REDIS_KEY_PREFIX = 'app:';

  // ── Health ─────────────────────────────────
  @Type(() => Number)
  @IsInt()
  @Min(100)
  HEALTH_CHECK_TIMEOUT_MS = 1500;

  @Type(() => Number)
  @IsInt()
  @Min(64)
  HEALTH_MEMORY_RSS_THRESHOLD_MB = 512;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    // 클래스 기본값을 유지하면서 raw 값만 덮어쓴다
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const summary = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    // 시크릿 값 자체는 절대 로그에 남기지 않는다 (property 이름과 제약 조건만 출력)
    throw new Error(`Invalid environment variables:\n${summary}`);
  }
  return config;
}

/** 타입 안전한 ConfigService 사용을 위한 별칭: `ConfigService<AppConfig, true>` */
export type AppConfig = EnvironmentVariables;
