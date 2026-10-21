'use client';

import { useQuery } from '@tanstack/react-query';
import type { DependencyHealth } from '@repo/shared-types';
import { StatusBadge } from '@/components/ui/status-badge';
import { browserApiClient } from '@/lib/api/browser-client';
import { isApiError } from '@/lib/api/api-error';
import { healthReportQueryOptions, HEALTH_POLL_INTERVAL_MS } from '../api/health.queries';
import { ComponentCard, Metric } from './component-card';
import { formatBytes, formatUptime } from './format';

/**
 * 진단 대시보드 (Client Component).
 * 초기 데이터는 서버에서 prefetch → HydrationBoundary 로 주입되므로 첫 렌더에 로딩 스피너가 없다.
 * 이후 HEALTH_POLL_INTERVAL_MS 주기로 브라우저에서 폴링한다.
 */
export function HealthDashboard() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useQuery(
    healthReportQueryOptions(browserApiClient),
  );

  if (isPending) {
    return <p className="text-zinc-500">진단 정보를 불러오는 중…</p>;
  }

  if (!data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <h2 className="font-semibold">
          {isApiError(error) ? error.problem.title : 'Unknown Error'}
        </h2>
        <p className="mt-1 text-sm">{error.message}</p>
        {isApiError(error) && error.requestId && (
          <p className="mt-2 font-mono text-xs opacity-70">requestId: {error.requestId}</p>
        )}
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-md bg-red-900 px-3 py-1.5 text-sm text-white hover:bg-red-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const { database, redis, memory } = data.components;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <StatusBadge status={data.status} />
          <span className="text-sm text-zinc-500">
            v{data.version} · uptime {formatUptime(data.uptimeSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span aria-live="polite">
            {isFetching
              ? '갱신 중…'
              : `마지막 갱신 ${new Date(dataUpdatedAt).toLocaleTimeString()}`}
          </span>
          <span>({HEALTH_POLL_INTERVAL_MS / 1000}s 주기)</span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 폴링 중 일시적 실패: 마지막 정상 데이터는 유지하되 경고를 노출 (stale-while-error) */}
      {error && (
        <p role="status" className="text-sm text-amber-600">
          최신 정보를 가져오지 못했습니다: {error.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <DependencyCard name="PostgreSQL" health={database} />
        <DependencyCard name="Redis" health={redis} />
        <ComponentCard name="Memory" status={memory.status}>
          <Metric
            label="RSS"
            value={`${formatBytes(memory.rssBytes)} / ${formatBytes(memory.rssThresholdBytes)}`}
          />
          <Metric label="Heap used" value={formatBytes(memory.heapUsedBytes)} />
          <Metric label="Heap total" value={formatBytes(memory.heapTotalBytes)} />
        </ComponentCard>
      </div>
    </div>
  );
}

function DependencyCard({ name, health }: { name: string; health: DependencyHealth }) {
  return (
    <ComponentCard name={name} status={health.status}>
      <Metric label="Latency" value={`${health.latencyMs.toFixed(2)} ms`} />
      {health.message && <Metric label="Reason" value={health.message} />}
    </ComponentCard>
  );
}
