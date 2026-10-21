import { Controller, Get, Header } from '@nestjs/common';
import type { HealthCheckResult, LivenessResult } from '@repo/shared-types';
import { HealthCheckFailedException } from './health-check-failed.exception';
import { HealthService } from './health.service';

/**
 * GET /api/v1/health       → Readiness (DB, Redis, Memory). 실패 시 503 + problem+json
 * GET /api/v1/health/live  → Liveness  (프로세스 생존 여부만)
 *
 * 컨트롤러는 HTTP 관심사(상태 코드/헤더)만 다루고, 판정 로직은 Service 에 위임한다.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  // 프록시/CDN 이 헬스 결과를 캐싱하면 장애를 정상으로 오판한다
  @Header('Cache-Control', 'no-store')
  async check(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();
    if (result.status === 'error') {
      throw new HealthCheckFailedException(result);
    }
    return result;
  }

  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): LivenessResult {
    return this.healthService.liveness();
  }
}
