import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DependencyHealth } from '@repo/shared-types';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis.constants';
import { type DependencyHealthIndicator, probeDependency } from './dependency-health.indicator';

@Injectable()
export class RedisHealthIndicator implements DependencyHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async check(timeoutMs: number): Promise<DependencyHealth> {
    const result = await probeDependency(() => this.redis.ping(), timeoutMs);
    if (result.status === 'down') {
      this.logger.warn(`Redis health check failed: ${result.message ?? 'unknown'}`);
    }
    return result;
  }
}
