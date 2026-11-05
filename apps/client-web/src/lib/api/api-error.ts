import { PROBLEM_TYPES, type ProblemDetails } from '@repo/shared-types';

/**
 * 모든 API 실패를 단일 타입으로 정규화한다.
 * UI 는 `instanceof ApiError` 하나로 분기하고, `problem.type` 으로 세부 처리를 결정한다.
 */
export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails, options?: { cause?: unknown }) {
    super(problem.detail ?? problem.title, options);
    this.name = 'ApiError';
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get requestId(): string | undefined {
    return this.problem.requestId;
  }

  /** 재시도해도 결과가 같은 클라이언트 오류인지 (TanStack Query retry 판단에 사용) */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  static network(cause: unknown): ApiError {
    const isTimeout = cause instanceof DOMException && cause.name === 'TimeoutError';
    return new ApiError(
      {
        type: PROBLEM_TYPES.NETWORK_ERROR,
        title: isTimeout ? 'Request Timeout' : 'Network Error',
        // 0 은 HTTP 범위를 벗어나므로 "응답 없음"을 503 계열로 표현
        status: 503,
        detail: isTimeout
          ? 'The server did not respond in time.'
          : 'Unable to reach the server. Check your connection.',
      },
      { cause },
    );
  }

  static contractViolation(status: number, cause: unknown): ApiError {
    return new ApiError(
      {
        type: PROBLEM_TYPES.CONTRACT_VIOLATION,
        title: 'Unexpected Response',
        status: status >= 400 ? status : 502,
        detail: 'The server response did not match the expected contract.',
      },
      { cause },
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
