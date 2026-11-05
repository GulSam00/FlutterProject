import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CONTENT_TYPES, PROBLEM_TYPES } from '@repo/shared-types';
import { createApiClient } from './api-client';
import { isApiError } from './api-error';

const ORIGIN = 'http://api.test';
const UserSchema = z.object({ id: z.string(), name: z.string() });

/** `/api/v1` prefix 를 붙인 전체 URL. 클라이언트가 prefix 를 빠뜨리면 이 상수와 어긋난다. */
const USERS_URL = `${ORIGIN}/api/v1/users`;

function envelope(data: unknown): string {
  return JSON.stringify({
    success: true,
    data,
    meta: {
      timestamp: '2026-11-05T00:00:00.000Z',
      requestId: 'req-1',
      path: '/api/v1/users',
    },
  });
}

function jsonResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': CONTENT_TYPES.JSON },
    ...init,
  });
}

/** fetch 를 가로채고, 호출된 URL/옵션을 검사할 수 있게 돌려준다 */
function stubFetch(impl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

/**
 * fetch 에 넘어간 첫 인자를 URL 문자열로 만든다.
 * `URL | RequestInfo` 를 그대로 `String()` 에 넣으면 Request 객체일 때 '[object Object]' 가 되므로
 * 타입을 좁혀서 꺼낸다 (테스트가 조용히 통과하는 것을 막는다).
 */
function requestedUrl(input: URL | RequestInfo | undefined): string {
  if (input instanceof URL) return input.href;
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  throw new Error('fetch 가 호출되지 않았습니다');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createApiClient', () => {
  it('envelope 를 벗기고 data 만 반환한다', async () => {
    const fetchSpy = stubFetch(() =>
      Promise.resolve(jsonResponse(envelope({ id: 'u1', name: '길동' }))),
    );
    const client = createApiClient({ origin: ORIGIN });

    await expect(client.get('/users', UserSchema)).resolves.toEqual({ id: 'u1', name: '길동' });

    // 버전 prefix 가 붙은 URL 로 요청하고, problem+json 도 받겠다고 알린다
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(requestedUrl(url)).toBe(USERS_URL);
    expect(new Headers(init?.headers).get('Accept')).toContain(CONTENT_TYPES.PROBLEM_JSON);
  });

  it('origin 끝의 슬래시가 중복 경로를 만들지 않는다', async () => {
    const fetchSpy = stubFetch(() =>
      Promise.resolve(jsonResponse(envelope({ id: 'u1', name: 'a' }))),
    );
    await createApiClient({ origin: `${ORIGIN}///` }).get('users', UserSchema);
    expect(requestedUrl(fetchSpy.mock.calls[0]?.[0])).toBe(USERS_URL);
  });

  it('undefined 쿼리 값은 쿼리스트링에서 제외한다', async () => {
    const fetchSpy = stubFetch(() =>
      Promise.resolve(jsonResponse(envelope({ id: 'u1', name: 'a' }))),
    );
    await createApiClient({ origin: ORIGIN }).get('/users', UserSchema, {
      query: { page: 2, keyword: undefined, active: true },
    });
    const url = new URL(requestedUrl(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('active')).toBe('true');
    expect(url.searchParams.has('keyword')).toBe(false);
  });

  it('data 가 스키마와 다르면 계약 위반 에러 (조용한 undefined 렌더링 방지)', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(envelope({ id: 'u1' })))); // name 없음
    const client = createApiClient({ origin: ORIGIN });

    const error = await client.get('/users', UserSchema).catch((e: unknown) => e);
    expect(isApiError(error) && error.problem.type).toBe(PROBLEM_TYPES.CONTRACT_VIOLATION);
  });

  it('envelope 모양이 아니면 계약 위반 에러', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(JSON.stringify({ id: 'u1', name: 'a' }))));
    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema)
      .catch((e: unknown) => e);
    expect(isApiError(error) && error.problem.type).toBe(PROBLEM_TYPES.CONTRACT_VIOLATION);
  });

  it('problem+json 에러 응답을 ApiError 로 정규화하고 requestId 를 보존한다', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse(
          JSON.stringify({
            type: PROBLEM_TYPES.NOT_FOUND,
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
            requestId: 'req-404',
          }),
          { status: 404, headers: { 'Content-Type': CONTENT_TYPES.PROBLEM_JSON } },
        ),
      ),
    );

    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema)
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) return;
    expect(error.status).toBe(404);
    expect(error.requestId).toBe('req-404');
    expect(error.isClientError).toBe(true);
  });

  it('프록시가 반환한 비표준 에러 본문(HTML)도 ApiError 가 된다', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema)
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) return;
    expect(error.status).toBe(502);
    expect(error.isClientError).toBe(false);
  });

  it('네트워크 오류를 ApiError 로 감싼다', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema)
      .catch((e: unknown) => e);
    expect(isApiError(error) && error.problem.type).toBe(PROBLEM_TYPES.NETWORK_ERROR);
  });

  it('호출자가 취소한 경우는 ApiError 로 감싸지 않고 그대로 전파한다', async () => {
    // TanStack Query 가 언마운트 시 취소하는 경로. ApiError 로 바꾸면 조용한 취소가 에러 화면이 된다.
    const controller = new AbortController();
    const abortError = new DOMException('aborted', 'AbortError');
    stubFetch(() => {
      controller.abort();
      return Promise.reject(abortError);
    });

    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema, { signal: controller.signal })
      .catch((e: unknown) => e);

    expect(error).toBe(abortError);
    expect(isApiError(error)).toBe(false);
  });

  it('204 응답은 본문 없이 처리된다', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    // 본문이 없으므로 envelope 검증에서 계약 위반이 된다 (조용히 null 을 넘기지 않는다)
    const error = await createApiClient({ origin: ORIGIN })
      .get('/users', UserSchema)
      .catch((e: unknown) => e);
    expect(isApiError(error) && error.problem.type).toBe(PROBLEM_TYPES.CONTRACT_VIOLATION);
  });

  it('POST 는 바디를 JSON 으로 직렬화하고 Content-Type 을 붙인다', async () => {
    const fetchSpy = stubFetch(() =>
      Promise.resolve(jsonResponse(envelope({ id: 'u1', name: 'a' }))),
    );
    await createApiClient({ origin: ORIGIN }).post('/users', UserSchema, {
      body: { name: 'a' },
    });

    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ name: 'a' }));
    expect(new Headers(init?.headers).get('Content-Type')).toBe(CONTENT_TYPES.JSON);
  });
});
