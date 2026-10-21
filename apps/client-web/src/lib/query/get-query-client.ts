import { environmentManager, QueryClient } from '@tanstack/react-query';
import { isApiError } from '../api/api-error';

const MAX_RETRIES = 2;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR 직후 클라이언트에서 즉시 refetch 하지 않도록 (hydration 직후 중복 요청 방지)
        staleTime: 30_000,
        // 4xx 는 재시도해도 결과가 같다 → 불필요한 서버 부하/지연 방지. 5xx/네트워크만 재시도
        retry: (failureCount, error) => {
          if (isApiError(error) && error.isClientError) return false;
          return failureCount < MAX_RETRIES;
        },
        refetchOnWindowFocus: true,
      },
      mutations: {
        // 비멱등 요청(POST 등)의 자동 재시도는 중복 생성 위험 → 기본 비활성
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * - 서버: 요청마다 새 인스턴스 (다른 사용자의 캐시가 섞이는 데이터 유출 방지)
 * - 브라우저: 싱글톤 (React Suspense 로 리렌더 시 캐시가 날아가지 않도록)
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
