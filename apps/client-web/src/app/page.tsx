import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Fullstack Boilerplate</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Next.js (App Router) · NestJS · PostgreSQL · Redis · Turborepo
      </p>
      <Link
        href="/health"
        className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      >
        시스템 진단 페이지 →
      </Link>
    </main>
  );
}
