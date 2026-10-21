import type { ComponentStatus, OverallHealthStatus } from '@repo/shared-types';

type Status = ComponentStatus | OverallHealthStatus;

const STYLE: Record<Status, string> = {
  up: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  ok: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  down: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
  error: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ring-1 ring-inset ${STYLE[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
