import {
  type Create__Pascal__Input,
  Create__Pascal__Schema,
  createPaginatedSchema,
  type Paginated,
  type __Pascal__,
  __Pascal__Schema,
  type Update__Pascal__Input,
} from '@repo/shared-types';
import type { ApiClient } from '@/lib/api/api-client';

/**
 * __Pascal__ API 호출. **생성된 뼈대다.**
 *
 * 모든 함수가 `ApiClient` 를 첫 인자로 받는다. 안에서 클라이언트를 직접 import 하지 않는다.
 * 서버 컴포넌트는 내부 주소를 쓰는 클라이언트를, 브라우저는 공개 주소를 쓰는 클라이언트를 넘긴다.
 * 여기서 `browserApiClient` 를 import 하면 SSR 이 공개 주소로 나갔다가 다시 들어오는 경로를 탄다.
 *
 * 응답은 반드시 스키마로 검증한다. 검증을 건너뛰면 백엔드 배포와 프론트 배포가 어긋났을 때
 * 화면에 조용히 `undefined` 가 렌더링된다.
 */
const __Pascal__PageSchema = createPaginatedSchema(__Pascal__Schema);

export interface Find__PascalPlural__Params {
  page?: number;
  limit?: number;
}

export function fetch__PascalPlural__(
  client: ApiClient,
  params: Find__PascalPlural__Params = {},
  signal?: AbortSignal,
): Promise<Paginated<__Pascal__>> {
  return client.get('/__kebabPlural__', __Pascal__PageSchema, {
    query: { page: params.page, limit: params.limit },
    signal,
  });
}

export function fetch__Pascal__(
  client: ApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<__Pascal__> {
  return client.get(`/__kebabPlural__/${id}`, __Pascal__Schema, { signal });
}

export function create__Pascal__(
  client: ApiClient,
  input: Create__Pascal__Input,
): Promise<__Pascal__> {
  // 보내기 전에 입력도 검증한다. 서버의 400 을 기다리는 대신 원인이 분명한 에러를 즉시 얻는다.
  return client.post('/__kebabPlural__', __Pascal__Schema, {
    body: Create__Pascal__Schema.parse(input),
  });
}

export function update__Pascal__(
  client: ApiClient,
  id: string,
  input: Update__Pascal__Input,
): Promise<__Pascal__> {
  return client.request('PATCH', `/__kebabPlural__/${id}`, __Pascal__Schema, { body: input });
}
