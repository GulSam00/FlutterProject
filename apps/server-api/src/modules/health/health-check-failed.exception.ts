import { HttpStatus } from '@nestjs/common';
import { type HealthCheckResult, PROBLEM_TYPES } from '@repo/shared-types';
import { ProblemException } from '../../common/exceptions/problem.exception';

/**
 * 하나 이상의 의존성이 down 일 때 503 + RFC 7807 로 응답한다.
 * `details` 에 전체 진단 결과를 실어 보내, 운영자가 어떤 컴포넌트가 문제인지 즉시 파악할 수 있게 한다.
 */
export class HealthCheckFailedException extends ProblemException {
  constructor(result: HealthCheckResult) {
    const failed = Object.entries(result.components)
      .filter(([, component]) => component.status === 'down')
      .map(([name]) => name);

    super({
      type: PROBLEM_TYPES.SERVICE_UNAVAILABLE,
      title: 'Service Unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail: `Unhealthy components: ${failed.join(', ')}`,
      details: result,
    });
  }
}
