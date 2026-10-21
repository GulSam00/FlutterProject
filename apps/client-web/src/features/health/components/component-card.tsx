import type { ComponentStatus } from '@repo/shared-types';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';

interface ComponentCardProps {
  name: string;
  status: ComponentStatus;
  children: ReactNode;
}

export function ComponentCard({ name, status, children }: ComponentCardProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{name}</h3>
        <StatusBadge status={status} />
      </header>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
