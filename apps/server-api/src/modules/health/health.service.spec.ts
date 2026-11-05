import type { ConfigService } from '@nestjs/config';
import type { DependencyHealth } from '@repo/shared-types';
import type { AppConfig } from '../../config/env.validation';
import { partialMock } from '../../test-support/partial-mock';
import { HealthService } from './health.service';
import type { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import type { RedisHealthIndicator } from './indicators/redis.health-indicator';

const UP: DependencyHealth = { status: 'up', latencyMs: 1 };
const DOWN: DependencyHealth = { status: 'down', latencyMs: 1500, message: 'timeout after 1500ms' };

function createService(db: DependencyHealth, redis: DependencyHealth): HealthService {
  const values: Partial<Record<keyof AppConfig, unknown>> = {
    HEALTH_CHECK_TIMEOUT_MS: 1500,
    // 테스트 프로세스 메모리에 영향받지 않도록 충분히 크게
    HEALTH_MEMORY_RSS_THRESHOLD_MB: 1_000_000,
    APP_VERSION: 'test',
  };
  // HealthService 는 `config.get` 하나만 쓴다. 그 메서드만 가진 타입으로 좁혀서 더블을 만들면
  // ConfigService 의 여러 오버로드를 흉내 내지 않아도 되고, 키 이름 오타는 그대로 잡힌다.
  const config = partialMock<Pick<ConfigService<AppConfig, true>, 'get'>>({
    get: (key: keyof AppConfig) => values[key],
  }) as ConfigService<AppConfig, true>;

  const database = partialMock<DatabaseHealthIndicator>({
    check: jest.fn().mockResolvedValue(db),
  });
  const redisIndicator = partialMock<RedisHealthIndicator>({
    check: jest.fn().mockResolvedValue(redis),
  });

  return new HealthService(config, database, redisIndicator, new MemoryHealthIndicator());
}

describe('HealthService', () => {
  it('모든 컴포넌트가 up 이면 ok', async () => {
    const result = await createService(UP, UP).check();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('test');
  });

  it('하나라도 down 이면 error', async () => {
    const result = await createService(UP, DOWN).check();
    expect(result.status).toBe('error');
    expect(result.components.redis).toEqual(DOWN);
  });

  it('liveness 는 의존성과 무관하게 ok', () => {
    expect(createService(DOWN, DOWN).liveness().status).toBe('ok');
  });
});
