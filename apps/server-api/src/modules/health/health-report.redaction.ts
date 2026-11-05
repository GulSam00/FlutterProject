import type { HealthCheckResult, LivenessResult } from '@repo/shared-types';

/**
 * 서버 내부에서 다루는 "전체" 진단 결과.
 *
 * 와이어 계약(`HealthCheckResult`)은 상세 필드가 모두 optional 이다. 응답에서 지울 수 있어야 하기 때문이다.
 * 하지만 `HealthService` 는 언제나 전부 채워서 만든다. 그 사실을 타입으로 고정해 두면,
 * 내부 로직(로그, 판정)이 `components` 를 쓸 때마다 불필요한 null 검사를 하지 않아도 되고
 * "채우는 쪽"과 "지우는 쪽"의 책임이 타입으로 드러난다.
 */
export type FullHealthReport = HealthCheckResult & {
  version: string;
  uptimeSeconds: number;
  components: NonNullable<HealthCheckResult['components']>;
};

export type FullLivenessResult = LivenessResult & { uptimeSeconds: number };

/**
 * 헬스 진단 결과에서 외부에 노출하면 안 되는 정보를 제거한다.
 *
 * 남기는 것: 전체 상태(`status`)와 점검 시각(`checkedAt`).
 * 지우는 것: 버전, uptime, 의존성 지연시간·실패 사유, 메모리 수치, 그리고 컴포넌트 목록 자체.
 *
 * 왜 컴포넌트 목록까지 지우는가
 *   "지금 redis 가 down" 이라는 정보 자체가 공격 시점을 알려주는 신호다.
 *   공개 엔드포인트는 "트래픽을 받을 수 있는가"(200/503)까지만 답하면 된다.
 *   장애 원인은 서버 로그와 상세 정보가 켜진 신뢰 환경에서 확인한다.
 *
 * 전체 보고서는 호출하는 쪽에서 로그로 남긴다. 즉 정보가 사라지는 것이 아니라 "응답에서만" 빠진다.
 */
export function redactHealthReport(report: FullHealthReport): HealthCheckResult {
  return {
    status: report.status,
    checkedAt: report.checkedAt,
  };
}

/** Liveness 는 uptime 만 상세 정보다 (재시작 시점을 알려준다). */
export function redactLivenessResult(result: FullLivenessResult): LivenessResult {
  return { status: result.status };
}
