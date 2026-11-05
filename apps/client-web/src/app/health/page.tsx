import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { HealthDashboard } from '@/features/health/components/health-dashboard';
import { healthReportQueryOptions } from '@/features/health/api/health.queries';
import { getServerApiClient } from '@/lib/api/server-client';
import { getQueryClient } from '@/lib/query/get-query-client';

export const metadata: Metadata = { title: 'System Health' };

// 빌드 시점에는 백엔드가 떠 있지 않으므로 정적 프리렌더링을 금지하고 요청마다 렌더링한다
export const dynamic = 'force-dynamic';

/**
 * Server Component.
 * - 내부망 주소(API_INTERNAL_URL)로 백엔드를 직접 호출해 초기 데이터를 prefetch
 * - prefetch 실패는 의도적으로 삼킨다(.catch) → 백엔드 장애 시에도 페이지 셸은 렌더링되고,
 *   클라이언트가 재시도하며 에러 UI 를 표시한다 (부분 장애가 전체 페이지 500 으로 번지지 않음)
 *   실패한 쿼리는 dehydrate 대상에서 제외되므로 클라이언트는 깨끗한 상태에서 다시 fetch 한다.
 */
export default async function HealthPage() {
  const queryClient = getQueryClient();
  await queryClient
    .query(healthReportQueryOptions(getServerApiClient()))
    .catch((error: unknown) => {
      // 서버 로그에만 남긴다 (클라이언트 측 재시도가 사용자에게 에러 UI 를 보여준다)
      console.error('[health] server prefetch failed', error);
    });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <code className="font-mono">GET /api/v1/health</code> · PostgreSQL / Redis / Memory
        </p>
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HealthDashboard />
      </HydrationBoundary>
    </main>
  );
}
