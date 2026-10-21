import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../../config/env.validation';

/**
 * 런타임(Nest)과 마이그레이션 CLI(data-source.ts)가 "동일한" 접속 옵션을 쓰도록 한 곳에서 생성한다.
 * 두 곳에 따로 정의하면 SSL/스키마 설정이 어긋나 마이그레이션만 실패하는 사고가 생긴다.
 */
export function buildDataSourceOptions(
  env: Pick<
    AppConfig,
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USERNAME'
    | 'DB_PASSWORD'
    | 'DB_NAME'
    | 'DB_SSL'
    | 'DB_POOL_MAX'
    | 'DB_RUN_MIGRATIONS'
    | 'APP_VERSION'
  >,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: true } : false,

    // 운영 리스크: synchronize=true 는 엔티티 변경 시 컬럼을 DROP 할 수 있다 → 프로덕션 데이터 유실.
    // 스키마 변경은 반드시 리뷰 가능한 마이그레이션 파일로만 수행한다.
    synchronize: false,
    migrationsRun: env.DB_RUN_MIGRATIONS,
    migrations: [`${__dirname}/migrations/*.{js,ts}`],
    migrationsTableName: 'typeorm_migrations',

    // node-postgres(pg.Pool) 레벨 옵션
    extra: {
      // 운영 리스크: Pod 수 × max 가 Postgres max_connections 를 넘으면 신규 커넥션이 거부된다.
      // HPA maxReplicas 를 고려해 산정하고, 규모가 커지면 PgBouncer 를 앞에 둔다.
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // 느린 쿼리가 커넥션을 무한정 점유해 풀 고갈 → 전체 장애로 번지는 것을 막는다
      statement_timeout: 15_000,
      application_name: `server-api@${env.APP_VERSION}`,
    },
  };
}
