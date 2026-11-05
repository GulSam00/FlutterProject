/**
 * 서버/클라이언트가 "문자열 리터럴"로 각자 하드코딩하면 언젠가 반드시 어긋난다.
 * 라우팅/헤더 규약은 이 파일 하나에서만 정의한다.
 */
export const API_GLOBAL_PREFIX = 'api' as const;
export const API_DEFAULT_VERSION = '1' as const;

export const HTTP_HEADERS = {
  /** 분산 추적용 요청 ID. Nginx → NestJS → 로그/에러 응답까지 동일 값이 전파된다. */
  REQUEST_ID: 'x-request-id',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  /** RFC 7807 / RFC 9457 에러 응답 미디어 타입 */
  PROBLEM_JSON: 'application/problem+json',
} as const;

/**
 * RFC 7807 `type` 필드에 사용할 문제 유형 URI.
 * 클라이언트는 HTTP status 보다 이 값으로 분기하는 것이 안정적이다
 * (예: 같은 400이라도 VALIDATION_FAILED 와 BAD_REQUEST 는 UX 처리가 다르다).
 */
export const PROBLEM_TYPES = {
  VALIDATION_FAILED: 'urn:problem-type:validation-failed',
  BAD_REQUEST: 'urn:problem-type:bad-request',
  UNAUTHORIZED: 'urn:problem-type:unauthorized',
  FORBIDDEN: 'urn:problem-type:forbidden',
  NOT_FOUND: 'urn:problem-type:not-found',
  CONFLICT: 'urn:problem-type:conflict',
  TOO_MANY_REQUESTS: 'urn:problem-type:too-many-requests',
  SERVICE_UNAVAILABLE: 'urn:problem-type:service-unavailable',
  INTERNAL_SERVER_ERROR: 'urn:problem-type:internal-server-error',
  /** 네트워크 단절/타임아웃 등 서버 응답 자체를 받지 못한 경우 (클라이언트 전용) */
  NETWORK_ERROR: 'urn:problem-type:network-error',
  /** 서버 응답이 계약(스키마)과 다를 때 (클라이언트 전용) */
  CONTRACT_VIOLATION: 'urn:problem-type:contract-violation',
} as const;

export type ProblemType = (typeof PROBLEM_TYPES)[keyof typeof PROBLEM_TYPES];
