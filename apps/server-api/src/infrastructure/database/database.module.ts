import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { type AppConfig, NodeEnv } from '../../config/env.validation';
import { buildDataSourceOptions } from './typeorm.options';

/**
 * PostgreSQL 연결 모듈 (Data Mapper 패턴).
 *
 * 새 도메인 추가 시:
 *   1) `modules/<domain>/entities/*.entity.ts` 에 `BaseEntity` 를 상속한 엔티티 정의
 *   2) 도메인 모듈에서 `TypeOrmModule.forFeature([Entity])` 로 Repository<Entity> 주입
 *   3) Service 는 커스텀 `<Domain>Repository` 클래스에만 의존 (ORM 세부사항 은닉)
 * `autoLoadEntities` 덕분에 여기 엔티티 목록을 수정할 필요가 없다.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        ...buildDataSourceOptions({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USERNAME: config.get('DB_USERNAME', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
          DB_SSL: config.get('DB_SSL', { infer: true }),
          DB_POOL_MAX: config.get('DB_POOL_MAX', { infer: true }),
          DB_RUN_MIGRATIONS: config.get('DB_RUN_MIGRATIONS', { infer: true }),
          APP_VERSION: config.get('APP_VERSION', { infer: true }),
        }),
        autoLoadEntities: true,
        // 부팅 시 DB 가 아직 준비되지 않았을 때(컨테이너 동시 기동) 재시도.
        // 끝내 실패하면 프로세스가 종료 → 오케스트레이터가 재시작하도록 위임한다.
        retryAttempts: 5,
        retryDelay: 3_000,
        logging:
          config.get('NODE_ENV', { infer: true }) === NodeEnv.Development
            ? ['error', 'warn']
            : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
