import {
  type FullHealthReport,
  type FullLivenessResult,
  redactHealthReport,
  redactLivenessResult,
} from './health-report.redaction';

const FULL_REPORT: FullHealthReport = {
  status: 'error',
  checkedAt: '2026-11-05T00:00:00.000Z',
  version: '1.4.2',
  uptimeSeconds: 86_400,
  components: {
    database: { status: 'up', latencyMs: 1.23 },
    redis: { status: 'down', latencyMs: 1500, message: 'timeout after 1500ms' },
    memory: {
      status: 'up',
      rssBytes: 123_456_789,
      heapUsedBytes: 50_000_000,
      heapTotalBytes: 80_000_000,
      rssThresholdBytes: 429_916_160,
    },
  },
};

describe('redactHealthReport', () => {
  it('status 와 checkedAt 만 남긴다', () => {
    expect(redactHealthReport(FULL_REPORT)).toEqual({
      status: 'error',
      checkedAt: '2026-11-05T00:00:00.000Z',
    });
  });

  // 상세 필드가 추가될 때 이 테스트가 깨져야 한다.
  // 새 필드를 무심코 공개 응답에 흘리는 것을 막는 것이 이 테스트의 목적이다.
  it('직렬화 결과에 버전·uptime·지연시간·메모리 수치·실패 사유가 남지 않는다', () => {
    const serialized = JSON.stringify(redactHealthReport(FULL_REPORT));
    for (const leak of [
      '1.4.2',
      '86400',
      'latencyMs',
      'timeout after 1500ms',
      'components',
      'rssBytes',
      '123456789',
    ]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it('정상 상태도 같은 모양으로 축약한다', () => {
    const ok: FullHealthReport = { ...FULL_REPORT, status: 'ok' };
    expect(Object.keys(redactHealthReport(ok)).sort()).toEqual(['checkedAt', 'status']);
  });
});

describe('redactLivenessResult', () => {
  it('uptime 을 제거한다 (재시작 시점 노출 방지)', () => {
    const full: FullLivenessResult = { status: 'ok', uptimeSeconds: 42 };
    expect(redactLivenessResult(full)).toEqual({ status: 'ok' });
  });
});
