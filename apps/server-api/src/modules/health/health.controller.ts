import { Controller, Get, Header, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckResult, LivenessResult } from '@repo/shared-types';
import type { AppConfig } from '../../config/env.validation';
import { HealthCheckFailedException } from './health-check-failed.exception';
import { redactHealthReport, redactLivenessResult } from './health-report.redaction';
import { HealthService } from './health.service';

/**
 * GET /api/v1/health       → Readiness (DB, Redis, Memory). 실패 시 503 + problem+json
 * GET /api/v1/health/live  → Liveness  (프로세스 생존 여부만)
 *
 * 컨트롤러는 HTTP 관심사(상태 코드/헤더/노출 범위)만 다루고, 판정 로직은 Service 에 위임한다.
 *
 * 노출 범위: `HEALTH_EXPOSE_DETAILS=false`(운영 기본값)면 응답에서 상세 정보를 제거한다.
 * 진단에 필요한 전체 보고서는 서버 로그에 남기므로, 정보가 사라지는 것이 아니라 경로만 바뀐다.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly exposeDetails: boolean;

  constructor(
    private readonly healthService: HealthService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.exposeDetails = config.get('HEALTH_EXPOSE_DETAILS', { infer: true });
  }

  @Get()
  // 프록시/CDN 이 헬스 결과를 캐싱하면 장애를 정상으로 오판한다
  @Header('Cache-Control', 'no-store')
  async check(): Promise<HealthCheckResult> {
    const report = await this.healthService.check();

    if (report.status === 'error') {
      // 응답에서 상세를 지우더라도 "어떤 의존성이 왜 실패했는지"는 운영자가 알아야 한다.
      // probe 주기마다 반복되므로 스택 없이 warn 으로 남긴다 (알람 피로도 방지).
      const down = Object.entries(report.components)
        .filter(([, component]) => component.status === 'down')
        .map(([name, component]) => `${name}(${'message' in component ? component.message : ''})`)
        .join(', ');
      this.logger.warn(`Readiness failed: ${down}`);
    }

    const body = this.exposeDetails ? report : redactHealthReport(report);
    if (report.status === 'error') {
      throw new HealthCheckFailedException(body);
    }
    return body;
  }

  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): LivenessResult {
    const result = this.healthService.liveness();
    return this.exposeDetails ? result : redactLivenessResult(result);
  }
}
