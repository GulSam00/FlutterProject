'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/query/get-query-client';

/**
 * 클라이언트 경계(Client Boundary)의 최상단.
 * layout.tsx(서버 컴포넌트)는 이 컴포넌트에 children 을 "넘기기만" 하므로
 * 하위 페이지들은 여전히 서버 컴포넌트로 남는다.
 */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
