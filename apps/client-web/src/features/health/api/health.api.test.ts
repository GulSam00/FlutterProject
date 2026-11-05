import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { type HealthCheckResult, PROBLEM_TYPES } from '@repo/shared-types';
import type { ApiClient, RequestOptions } from '@/lib/api/api-client';
import { ApiError, isApiError } from '@/lib/api/api-error';
import { fetchHealthReport } from './health.api';

/** components 를 non-null 로 들고 있어야 테스트에서 `!` 없이 덮어쓸 수 있다 */
const COMPONENTS: NonNullable<HealthCheckResult['components']> = {
  database: { status: 'up', latencyMs: 1 },
  redis: { status: 'up', latencyMs: 1 },
  memory: { status: 'up', rssBytes: 1, heapUsedBytes: 1, heapTotalBytes: 1, rssThresholdBytes: 2 },
};

const FULL_REPORT: HealthCheckResult = {
  status: 'ok',
  checkedAt: '2026-11-05T00:00:00.000Z',
  version: '1.0.0',
  uptimeSeconds: 10,
  components: COMPONENTS,
};

/**
 * 요청을 보내지 않고 정해진 결과만 돌려주는 ApiClient.
 * 성공 경로에서도 실제 클라이언트와 같게 Zod 검증을 거치게 해 두었다.
 * 검증을 건너뛰면 "스키마에 맞지 않는 값이 통과하는" 테스트가 되어 의미가 없다.
 */
function stubClient(outcome: { data: unknown } | { error: Error }): ApiClient {
  const request = <TSchema extends z.ZodType>(
    _method: string,
    _path: string,
    schema: TSchema,
    _options?: RequestOptions,
  ): Promise<z.infer<TSchema>> => {
    if ('error' in outcome) return Promise.reject(outcome.error);
    return Promise.resolve(schema.parse(outcome.data));
  };
  return {
    request,
    get: (path, schema, options) => request('GET', path, schema, options),
    post: (path, schema, options) => request('POST', path, schema, options),
  };
}

function serviceUnavailable(details: unknown): ApiError {
  return new ApiError({
    type: PROBLEM_TYPES.SERVICE_UNAVAILABLE,
    title: 'Service Unavailable',
    status: 503,
    detail: 'Unhealthy components: redis',
    details,
    requestId: 'req-503',
  });
}

describe('fetchHealthReport', () => {
  it('200 응답은 그대로 반환한다', async () => {
    await expect(fetchHealthReport(stubClient({ data: FULL_REPORT }))).resolves.toEqual(
      FULL_REPORT,
    );
  });

  // 진단 페이지 입장에서 503 은 "실패"가 아니라 "유효한 진단 결과"다.
  // 이걸 에러로만 다루면 장애 때 정작 원인을 보여주는 화면이 빈다.
  it('503 의 details 가 계약에 맞으면 데이터로 승격한다', async () => {
    const report: HealthCheckResult = {
      ...FULL_REPORT,
      status: 'error',
      components: {
        ...COMPONENTS,
        redis: { status: 'down', latencyMs: 1500, message: 'timeout after 1500ms' },
      },
    };

    const result = await fetchHealthReport(stubClient({ error: serviceUnavailable(report) }));
    expect(result.status).toBe('error');
    expect(result.components?.redis.message).toBe('timeout after 1500ms');
  });

  // 서버가 HEALTH_EXPOSE_DETAILS=false 로 돌면 details 에 {status, checkedAt} 만 담긴다.
  // 이것도 계약에 맞는 유효한 결과이므로 데이터로 승격돼야 한다.
  it('503 의 details 가 축약된 형태여도 데이터로 승격한다', async () => {
    const redacted = { status: 'error', checkedAt: '2026-11-05T00:00:00.000Z' };
    const result = await fetchHealthReport(stubClient({ error: serviceUnavailable(redacted) }));
    expect(result).toEqual(redacted);
    expect(result.components).toBeUndefined();
  });

  it('503 의 details 가 계약과 다르면 에러를 그대로 전파한다', async () => {
    const error = await fetchHealthReport(
      stubClient({ error: serviceUnavailable({ status: 'not-a-status' }) }),
    ).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) return;
    expect(error.status).toBe(503);
  });

  it('details 가 없는 503 도 에러로 전파한다 (Nginx 가 만든 503 등)', async () => {
    const error = await fetchHealthReport(
      stubClient({ error: serviceUnavailable(undefined) }),
    ).catch((e: unknown) => e);
    expect(isApiError(error) && error.status).toBe(503);
  });

  it('503 이 아닌 에러는 승격하지 않는다', async () => {
    // 500 의 본문이 우연히 계약에 맞더라도 진단 결과로 다루지 않는다
    const error = await fetchHealthReport(
      stubClient({
        error: new ApiError({
          type: PROBLEM_TYPES.INTERNAL_SERVER_ERROR,
          title: 'Internal Server Error',
          status: 500,
          details: FULL_REPORT,
        }),
      }),
    ).catch((e: unknown) => e);

    expect(isApiError(error) && error.status).toBe(500);
  });

  it('네트워크 오류는 그대로 전파한다', async () => {
    const networkError = ApiError.network(new TypeError('fetch failed'));
    const error = await fetchHealthReport(stubClient({ error: networkError })).catch(
      (e: unknown) => e,
    );
    expect(error).toBe(networkError);
  });
});
