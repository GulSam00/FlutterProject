import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';

const logger = new Logger('RedisModule');

/**
 * ioredis 기반 전역 Redis 모듈.
 *
 * - 캐시, 분산 락, Rate limit 카운터 등 범용 용도로 `@Inject(REDIS_CLIENT)` 하여 사용한다.
 * - BullMQ 도입 시: BullMQ 는 블로킹 커맨드(BRPOPLPUSH 등)를 쓰므로 이 클라이언트를 공유하지 말고
 *   `maxRetriesPerRequest: null` 옵션의 전용 커넥션을 별도로 만들어야 한다.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Redis => {
        const client = new Redis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: config.get('REDIS_PASSWORD', { infer: true }),
          db: config.get('REDIS_DB', { infer: true }),
          keyPrefix: config.get('REDIS_KEY_PREFIX', { infer: true }),
          connectionName: `server-api@${config.get('APP_VERSION', { infer: true })}`,
          connectTimeout: 5_000,
          // 운영 리스크: Redis 장애 시 명령이 무한정 큐잉되면 메모리가 폭증하고 요청이 hang 된다.
          // 캐시는 "없어도 서비스는 돈다"가 원칙이므로 빠르게 실패(fail-fast)시키고 상위에서 fallback 한다.
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          // 지수 백오프 재연결 (최대 5초 간격). null 을 반환하지 않으므로 영구 재시도한다.
          retryStrategy: (times: number) => Math.min(times * 200, 5_000),
        });

        client.on('error', (err: Error) => {
          // 'error' 리스너가 없으면 Node 가 unhandled error 로 프로세스를 죽인다
          logger.error(`Redis error: ${err.message}`);
        });
        client.on('ready', () => {
          logger.log('Redis connection ready');
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** SIGTERM 시 진행 중인 명령을 마무리하고 연결을 정상 종료한다 (커넥션 누수 방지) */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
