import { z } from 'zod';
import { createApiResponseSchema } from './api-response';

export const ComponentStatusSchema = z.enum(['up', 'down']);
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const OverallHealthStatusSchema = z.enum(['ok', 'error']);
export type OverallHealthStatus = z.infer<typeof OverallHealthStatusSchema>;

/**
 * 외부 의존성(DB, Redis 등) 하나의 상태.
 *
 * `status` 를 뺀 필드는 모두 optional 이다. 서버가 `HEALTH_EXPOSE_DETAILS=false`(운영 기본값)로 돌면
 * 상세 정보를 지우고 응답하기 때문이다. 클라이언트는 값이 없는 경우를 반드시 처리해야 한다.
 */
export const DependencyHealthSchema = z.object({
  status: ComponentStatusSchema,
  /** 핑 왕복 시간(ms). 연결 실패 시에도 타임아웃까지 걸린 시간을 기록해 장애 분석에 활용 */
  latencyMs: z.number().nonnegative().optional(),
  /** 실패 사유. 내부 구현 정보(호스트명, 스택)는 노출하지 않는다. */
  message: z.string().optional(),
});
export type DependencyHealth = z.infer<typeof DependencyHealthSchema>;

/** 프로세스 메모리 상태 (수치는 상세 정보 — 위 DependencyHealthSchema 주석 참조) */
export const MemoryHealthSchema = z.object({
  status: ComponentStatusSchema,
  rssBytes: z.number().nonnegative().optional(),
  heapUsedBytes: z.number().nonnegative().optional(),
  heapTotalBytes: z.number().nonnegative().optional(),
  /** 임계치로 사용한 RSS 상한 (bytes) */
  rssThresholdBytes: z.number().nonnegative().optional(),
});
export type MemoryHealth = z.infer<typeof MemoryHealthSchema>;

/**
 * Readiness 진단 결과.
 *
 * `status` 와 `checkedAt` 만 항상 있다. 나머지(버전, uptime, 컴포넌트별 상세)는
 * 서버가 `HEALTH_EXPOSE_DETAILS=true` 일 때만 채운다.
 *
 * 왜 이렇게 나눴는가: 공개된 헬스 엔드포인트가 버전·메모리 수치·의존성 지연시간을 흘리면
 * 공격자가 버전을 특정하고, 의존성이 흔들리는 시점을 골라 공격할 수 있다.
 * 반면 K8s probe 와 로드밸런서는 HTTP 상태 코드(200/503)만 필요하다.
 */
export const HealthCheckResultSchema = z.object({
  status: OverallHealthStatusSchema,
  checkedAt: z.iso.datetime(),
  /** 애플리케이션 버전 (배포 추적용). 상세 정보가 켜져 있을 때만 포함된다. */
  version: z.string().optional(),
  uptimeSeconds: z.number().nonnegative().optional(),
  components: z
    .object({
      database: DependencyHealthSchema,
      redis: DependencyHealthSchema,
      memory: MemoryHealthSchema,
    })
    .optional(),
});
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/** Liveness 전용 (의존성 체크 없음). uptime 은 재시작 시점을 알려주므로 상세 정보로 취급한다. */
export const LivenessResultSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative().optional(),
});
export type LivenessResult = z.infer<typeof LivenessResultSchema>;

export const HealthCheckResponseSchema = createApiResponseSchema(HealthCheckResultSchema);
