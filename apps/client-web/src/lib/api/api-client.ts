import {
  API_DEFAULT_VERSION,
  API_GLOBAL_PREFIX,
  CONTENT_TYPES,
  createApiResponseSchema,
  ProblemDetailsSchema,
} from '@repo/shared-types';
import { z } from 'zod';
import { ApiError } from './api-error';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends Omit<RequestInit, 'method' | 'body' | 'signal'> {
  /** JSON 직렬화될 요청 바디 */
  body?: unknown;
  /** 쿼리스트링 (undefined 값은 제외) */
  query?: Record<string, string | number | boolean | undefined>;
  /** 호출자 취소 신호 (TanStack Query 가 넘겨주는 signal 등) */
  signal?: AbortSignal;
  /** 요청 타임아웃(ms). 기본 10초 */
  timeoutMs?: number;
}

export interface ApiClient {
  request<TSchema extends z.ZodType>(
    method: HttpMethod,
    path: string,
    schema: TSchema,
    options?: RequestOptions,
  ): Promise<z.infer<TSchema>>;
  get<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options?: RequestOptions,
  ): Promise<z.infer<TSchema>>;
  post<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options?: RequestOptions,
  ): Promise<z.infer<TSchema>>;
}

export interface ApiClientConfig {
  /** API Origin (예: http://api.local.dev). 버전 prefix 는 자동으로 붙는다 */
  origin: string;
  defaultHeaders?: HeadersInit;
  defaultTimeoutMs?: number;
}

const API_BASE_PATH = `/${API_GLOBAL_PREFIX}/v${API_DEFAULT_VERSION}`;

/** envelope(success/meta) 검증과 data 검증을 분리 → 제네릭 추론이 정확해지고 에러 원인도 구분된다 */
const EnvelopeSchema = createApiResponseSchema(z.unknown());

/**
 * 표준 Fetch 래퍼.
 *
 * 책임
 *  1. 표준 응답 언래핑: `{ success, data, meta }` → `data` 만 반환 (호출부는 envelope 를 몰라도 된다)
 *  2. 런타임 계약 검증: 응답을 Zod 로 검증 → 백엔드 배포와 프론트 배포가 어긋났을 때 "조용히 undefined 렌더링" 대신 명시적 에러
 *  3. 에러 정규화: HTTP 에러(RFC 7807) / 네트워크 / 타임아웃 / 계약 위반 → 모두 ApiError
 *  4. 타임아웃 + 취소: 응답 없는 서버가 RSC 렌더링 전체를 붙잡고 있는 것을 방지
 *
 * 서버(RSC)와 브라우저에서 동일한 구현을 공유하고, origin 만 다르게 주입한다.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = `${config.origin.replace(/\/+$/, '')}${API_BASE_PATH}`;
  const defaultTimeoutMs = config.defaultTimeoutMs ?? 10_000;

  async function request<TSchema extends z.ZodType>(
    method: HttpMethod,
    path: string,
    schema: TSchema,
    options: RequestOptions = {},
  ): Promise<z.infer<TSchema>> {
    const { body, query, signal, timeoutMs = defaultTimeoutMs, headers, ...init } = options;

    const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    const requestHeaders = new Headers(config.defaultHeaders);
    requestHeaders.set('Accept', `${CONTENT_TYPES.JSON}, ${CONTENT_TYPES.PROBLEM_JSON}`);
    if (body !== undefined) requestHeaders.set('Content-Type', CONTENT_TYPES.JSON);
    new Headers(headers).forEach((value, key) => {
      requestHeaders.set(key, value);
    });

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (error: unknown) {
      // 호출자가 의도적으로 취소한 경우(컴포넌트 언마운트 등)는 그대로 전파 → TanStack Query 가 조용히 처리
      if (signal?.aborted) throw error;
      throw ApiError.network(error);
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(payload);
      if (problem.success) throw new ApiError(problem.data);
      // 프록시(Nginx 502 HTML 페이지 등)가 반환한 비표준 에러 응답
      throw ApiError.contractViolation(response.status, payload);
    }

    const envelope = EnvelopeSchema.safeParse(payload);
    if (!envelope.success) {
      throw ApiError.contractViolation(response.status, envelope.error);
    }
    const data = schema.safeParse(envelope.data.data);
    if (!data.success) {
      throw ApiError.contractViolation(response.status, data.error);
    }
    return data.data;
  }

  return {
    request,
    get: (path, schema, options) => request('GET', path, schema, options),
    post: (path, schema, options) => request('POST', path, schema, options),
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
