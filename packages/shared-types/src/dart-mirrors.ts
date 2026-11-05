import type { z } from 'zod';
import { FieldErrorSchema, ProblemDetailsSchema, ResponseMetaSchema } from './api-response';
import {
  DependencyHealthSchema,
  HealthCheckResultSchema,
  LivenessResultSchema,
  MemoryHealthSchema,
} from './health';

/**
 * Dart 쪽에 **손으로 옮긴 사본**이 있는 계약들.
 *
 * 왜 이 목록이 필요한가
 *   `apps/client-mobile` 의 모델은 이 패키지의 Zod 스키마를 사람이 보고 옮긴 것이다.
 *   TypeScript 컴파일러는 둘 사이의 어긋남을 모른다. 필드를 하나 추가하고 Dart 를 잊으면
 *   배포된 앱에서만 드러난다.
 *
 *   `scripts/check-dart-contract.mjs` 가 이 목록을 읽어, 각 스키마의 필드와
 *   대응하는 Dart 클래스가 실제로 읽는 JSON 키를 비교한다.
 *
 * 계약을 추가하면서 Dart 사본도 만들었다면 여기에 등록한다.
 * 모바일에서 쓰지 않는 계약(`PageInfo` 처럼 Dart 가 일부만 읽는 것 포함)은 등록하지 않는다.
 */
export const DART_MIRRORED_CONTRACTS: Readonly<Record<string, z.ZodType>> = {
  ResponseMeta: ResponseMetaSchema,
  FieldError: FieldErrorSchema,
  ProblemDetails: ProblemDetailsSchema,
  DependencyHealth: DependencyHealthSchema,
  MemoryHealth: MemoryHealthSchema,
  HealthCheckResult: HealthCheckResultSchema,
  LivenessResult: LivenessResultSchema,
};
