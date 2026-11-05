import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@/lib/api/api-client';
import { fetchHealthReport } from './health.api';

/**
 * Query Key Factory.
 * 키를 문자열 배열로 흩뿌리지 않고 한 곳에서 생성 → 무효화(invalidateQueries) 시 오타로 인한 캐시 불일치 방지.
 */
export const healthKeys = {
  all: ['health'] as const,
  report: () => [...healthKeys.all, 'report'] as const,
};

export const HEALTH_POLL_INTERVAL_MS = 10_000;

/**
 * 서버(RSC prefetch)와 클라이언트(useQuery)가 "같은 queryKey" 를 공유해야 hydration 이 성립한다.
 * 호출 환경에 따라 base URL 만 다른 ApiClient 를 주입받는다.
 */
export function healthReportQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: healthKeys.report(),
    queryFn: ({ signal }) => fetchHealthReport(client, signal),
    // 진단 데이터는 항상 최신이어야 한다
    staleTime: 0,
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    // 백그라운드 탭에서는 폴링 중단 → 불필요한 서버 부하 방지
    refetchIntervalInBackground: false,
  });
}
