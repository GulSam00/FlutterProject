import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckResult, LivenessResult } from '@repo/shared-types';
import type { AppConfig } from '../../config/env.validation';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Injectable()
export class HealthService {
  private readonly timeoutMs: number;
  private readonly rssThresholdMb: number;
  private readonly version: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {
    this.timeoutMs = config.get('HEALTH_CHECK_TIMEOUT_MS', { infer: true });
    this.rssThresholdMb = config.get('HEALTH_MEMORY_RSS_THRESHOLD_MB', { infer: true });
    this.version = config.get('APP_VERSION', { infer: true });
  }

  /**
   * Readiness 진단: 모든 의존성을 "병렬"로 점검한다.
   * 직렬로 하면 최악의 경우 응답시간 = Σ(timeout) 이 되어 probe 타임아웃을 넘긴다.
   */
  async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.database.check(this.timeoutMs),
      this.redis.check(this.timeoutMs),
    ]);
    const memory = this.memory.check(this.rssThresholdMb);

    const components = { database, redis, memory };
    const allUp = Object.values(components).every((c) => c.status === 'up');

    return {
      status: allUp ? 'ok' : 'error',
      version: this.version,
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
      components,
    };
  }

  /**
   * Liveness 진단: 외부 의존성을 절대 확인하지 않는다.
   * DB 장애 시 liveness 가 실패하면 k8s 가 "멀쩡한" 모든 Pod 를 동시에 재시작 → 장애 증폭(cascading failure).
   */
  liveness(): LivenessResult {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }
}
