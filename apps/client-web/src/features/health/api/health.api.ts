import {
  type HealthCheckResult,
  HealthCheckResultSchema,
  LivenessResultSchema,
  type LivenessResult,
} from '@repo/shared-types';
import type { ApiClient } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';

/**
 * 헬스 리포트 조회.
 *
 * 서버는 의존성 장애 시 503 + problem+json(details = 진단 결과)을 반환한다.
 * 진단 페이지 입장에서 503 은 "실패"가 아니라 "유효한 진단 결과"이므로,
 * details 가 계약에 맞으면 정상 데이터로 승격하고 그 외에는 에러로 전파한다.
 */
export async function fetchHealthReport(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<HealthCheckResult> {
  try {
    return await client.get('/health', HealthCheckResultSchema, { signal, cache: 'no-store' });
  } catch (error: unknown) {
    if (isApiError(error) && error.status === 503) {
      const report = HealthCheckResultSchema.safeParse(error.problem.details);
      if (report.success) return report.data;
    }
    throw error;
  }
}

export function fetchLiveness(client: ApiClient, signal?: AbortSignal): Promise<LivenessResult> {
  return client.get('/health/live', LivenessResultSchema, { signal, cache: 'no-store' });
}
