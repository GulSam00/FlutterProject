import { z } from 'zod';
import { createApiResponseSchema } from './api-response';

export const ComponentStatusSchema = z.enum(['up', 'down']);
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const OverallHealthStatusSchema = z.enum(['ok', 'error']);
export type OverallHealthStatus = z.infer<typeof OverallHealthStatusSchema>;

/** 외부 의존성(DB, Redis 등) 하나의 상태 */
export const DependencyHealthSchema = z.object({
  status: ComponentStatusSchema,
  /** 핑 왕복 시간(ms). 연결 실패 시에도 타임아웃까지 걸린 시간을 기록해 장애 분석에 활용 */
  latencyMs: z.number().nonnegative(),
  /** 실패 사유. 내부 구현 정보(호스트명, 스택)는 노출하지 않는다. */
  message: z.string().optional(),
});
export type DependencyHealth = z.infer<typeof DependencyHealthSchema>;

/** 프로세스 메모리 상태 */
export const MemoryHealthSchema = z.object({
  status: ComponentStatusSchema,
  rssBytes: z.number().nonnegative(),
  heapUsedBytes: z.number().nonnegative(),
  heapTotalBytes: z.number().nonnegative(),
  /** 임계치로 사용한 RSS 상한 (bytes) */
  rssThresholdBytes: z.number().nonnegative(),
});
export type MemoryHealth = z.infer<typeof MemoryHealthSchema>;

export const HealthCheckResultSchema = z.object({
  status: OverallHealthStatusSchema,
  /** 애플리케이션 버전 (배포 추적용) */
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  checkedAt: z.iso.datetime(),
  components: z.object({
    database: DependencyHealthSchema,
    redis: DependencyHealthSchema,
    memory: MemoryHealthSchema,
  }),
});
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/** Liveness 전용 (의존성 체크 없음) */
export const LivenessResultSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
});
export type LivenessResult = z.infer<typeof LivenessResultSchema>;

export const HealthCheckResponseSchema = createApiResponseSchema(HealthCheckResultSchema);
