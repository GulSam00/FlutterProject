import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@/lib/api/api-client';
import {
  fetch__Pascal__,
  fetch__PascalPlural__,
  type Find__PascalPlural__Params,
} from './__kebab__.api';

/**
 * Query Key Factory. 키를 컴포넌트에 흩뿌리지 않고 한 곳에서 만든다.
 * 오타 하나로 캐시가 갈라지는 것을 막고, `invalidateQueries({ queryKey: __camel__Keys.all })` 한 번으로
 * 이 도메인의 모든 쿼리를 무효화할 수 있다.
 */
export const __camel__Keys = {
  all: ['__kebabPlural__'] as const,
  lists: () => [...__camel__Keys.all, 'list'] as const,
  // 파라미터를 키에 포함해야 페이지마다 다른 캐시 항목이 된다
  list: (params: Find__PascalPlural__Params) => [...__camel__Keys.lists(), params] as const,
  details: () => [...__camel__Keys.all, 'detail'] as const,
  detail: (id: string) => [...__camel__Keys.details(), id] as const,
};

/**
 * 서버(RSC prefetch)와 브라우저(useQuery)가 같은 queryKey 를 써야 hydration 이 성립한다.
 * 그래서 이 팩토리를 양쪽에서 공유하고, 환경에 따라 다른 `ApiClient` 만 주입한다.
 */
export function __camel__ListQueryOptions(
  client: ApiClient,
  params: Find__PascalPlural__Params = {},
) {
  return queryOptions({
    queryKey: __camel__Keys.list(params),
    queryFn: ({ signal }) => fetch__PascalPlural__(client, params, signal),
  });
}

export function __camel__DetailQueryOptions(client: ApiClient, id: string) {
  return queryOptions({
    queryKey: __camel__Keys.detail(id),
    queryFn: ({ signal }) => fetch__Pascal__(client, id, signal),
  });
}
