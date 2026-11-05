import { HttpStatus } from '@nestjs/common';
import { type HealthCheckResult, PROBLEM_TYPES } from '@repo/shared-types';
import { ProblemException } from '../../common/exceptions/problem.exception';

/**
 * 하나 이상의 의존성이 down 일 때 503 + RFC 7807 로 응답한다.
 *
 * 받은 `result` 를 그대로 `details` 에 싣는다. 노출 범위 판단은 컨트롤러가 이미 끝냈으므로
 * (`HEALTH_EXPOSE_DETAILS`), 이 예외는 "받은 것만 보낸다". 두 곳에서 각자 판단하면 한쪽을 고칠 때 다른 쪽이 새는 길이 된다.
 *
 * `detail` 문구도 같은 기준을 따른다. 상세가 제거된 결과(`components` 없음)에서
 * "Unhealthy components: redis" 같은 문구를 만들면, 본문은 가렸는데 문구로 흘리는 셈이 된다.
 */
export class HealthCheckFailedException extends ProblemException {
  constructor(result: HealthCheckResult) {
    super({
      type: PROBLEM_TYPES.SERVICE_UNAVAILABLE,
      title: 'Service Unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail: buildDetail(result),
      details: result,
    });
  }
}

function buildDetail(result: HealthCheckResult): string {
  if (!result.components) {
    return 'The service is not ready to accept traffic.';
  }
  const failed = Object.entries(result.components)
    .filter(([, component]) => component.status === 'down')
    .map(([name]) => name);
  return `Unhealthy components: ${failed.join(', ')}`;
}
