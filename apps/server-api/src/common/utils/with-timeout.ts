export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Promise 에 타임아웃을 건다.
 *
 * 운영 리스크: 헬스체크가 DB 응답을 무한정 기다리면 k8s probe(timeoutSeconds) 가 먼저 끊어 버려
 * "왜 실패했는지" 정보가 남지 않는다. 앱 레벨 타임아웃을 probe 타임아웃보다 짧게 두어
 * 항상 의미 있는 진단 결과를 반환하게 한다.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    // 타이머 누수 방지 (이벤트 루프가 불필요하게 살아있지 않도록)
    clearTimeout(timer);
  }
}
