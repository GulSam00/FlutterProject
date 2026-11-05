'use client';

import { useEffect } from 'react';

/**
 * 라우트 세그먼트 에러 경계.
 * 렌더링 중 예외가 발생해도 레이아웃(네비게이션 등)은 유지되고 이 영역만 대체된다.
 * 서버에서 발생한 에러의 message 는 프로덕션에서 마스킹되므로 digest 로 서버 로그와 대조한다.
 */
export default function HealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 실무에서는 Sentry 등 에러 수집기로 전송
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-xl font-semibold">진단 페이지를 표시할 수 없습니다.</h1>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-500">digest: {error.digest}</p>
      )}
      <button type="button" onClick={reset} className="mt-4 rounded-md border px-3 py-1.5 text-sm">
        다시 시도
      </button>
    </main>
  );
}
