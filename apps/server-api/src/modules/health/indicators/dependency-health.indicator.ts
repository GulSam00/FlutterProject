import type { DependencyHealth } from '@repo/shared-types';
import { TimeoutError, withTimeout } from '../../../common/utils/with-timeout';

/**
 * 외부 의존성 상태 점검기의 공통 계약.
 * 새 의존성(S3, 외부 API, Kafka 등)이 생기면 이 인터페이스를 구현해 HealthService 에 추가한다.
 */
export interface DependencyHealthIndicator {
  check(timeoutMs: number): Promise<DependencyHealth>;
}

/**
 * 핑 함수를 실행하고 지연시간/실패 사유를 표준 형태로 기록한다.
 * 절대 throw 하지 않는다 → 한 의존성의 실패가 다른 의존성 점검을 중단시키지 않도록.
 */
export async function probeDependency(
  ping: () => Promise<unknown>,
  timeoutMs: number,
): Promise<DependencyHealth> {
  const startedAt = performance.now();
  try {
    await withTimeout(ping(), timeoutMs);
    return { status: 'up', latencyMs: elapsed(startedAt) };
  } catch (error: unknown) {
    return {
      status: 'down',
      latencyMs: elapsed(startedAt),
      // 내부 호스트명/자격증명이 포함될 수 있는 원본 메시지 대신 분류된 사유만 노출
      message: error instanceof TimeoutError ? `timeout after ${timeoutMs}ms` : 'unreachable',
    };
  }
}

function elapsed(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
