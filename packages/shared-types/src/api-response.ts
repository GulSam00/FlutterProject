import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*                               Success envelope                             */
/* -------------------------------------------------------------------------- */

export const ResponseMetaSchema = z.object({
  /** 서버가 응답을 생성한 시각 (ISO-8601, UTC) */
  timestamp: z.iso.datetime(),
  /** 요청 추적 ID (x-request-id 헤더와 동일) */
  requestId: z.string().min(1),
  /** 요청 경로 */
  path: z.string(),
});
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

/**
 * 표준 성공 응답 규격.
 *
 * ```json
 * { "success": true, "data": { ... }, "meta": { "timestamp": "...", "requestId": "...", "path": "..." } }
 * ```
 *
 * `success` 를 리터럴 `true` 로 고정해 두면, 클라이언트에서 판별 유니온으로 확장할 때
 * TypeScript 가 자동으로 좁히기(narrowing) 를 해준다.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * 런타임 검증용 제네릭 스키마 팩토리.
 * 컴파일 타임 타입(`ApiResponse<T>`)만으로는 "서버가 실제로 그 모양을 보냈는지" 보장할 수 없으므로,
 * 신뢰 경계(네트워크)를 넘는 지점에서는 반드시 런타임 검증을 거친다.
 */
export const createApiResponseSchema = <TData extends z.ZodType>(dataSchema: TData) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ResponseMetaSchema,
  });

/* -------------------------------------------------------------------------- */
/*                         Error envelope (RFC 7807)                          */
/* -------------------------------------------------------------------------- */

export const FieldErrorSchema = z.object({
  /** 에러가 발생한 필드 경로 (예: "address.zipCode") */
  field: z.string(),
  /** 위반한 제약 조건 메시지 목록 */
  messages: z.array(z.string()),
});
export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * RFC 7807 (Problem Details for HTTP APIs) 호환 에러 응답.
 * `requestId`, `timestamp`, `errors`, `details` 는 RFC 가 허용하는 확장 멤버(extension members)다.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  timestamp: z.iso.datetime().optional(),
  /** 입력값 검증 실패 시 필드 단위 상세 */
  errors: z.array(FieldErrorSchema).optional(),
  /** 도메인별 추가 컨텍스트 (예: 헬스체크 실패 시 컴포넌트별 상태). 소비 측에서 별도 스키마로 재검증한다. */
  details: z.unknown().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

/* -------------------------------------------------------------------------- */
/*                                 Pagination                                 */
/* -------------------------------------------------------------------------- */

/** 향후 목록 API 를 위한 페이지네이션 규격 (도메인 비종속) */
export const PageInfoSchema = z.object({
  page: z.number().int().min(1),
  size: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

export const createPaginatedSchema = <TItem extends z.ZodType>(itemSchema: TItem) =>
  z.object({
    items: z.array(itemSchema),
    pageInfo: PageInfoSchema,
  });
