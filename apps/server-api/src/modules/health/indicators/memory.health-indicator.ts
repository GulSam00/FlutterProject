import { Injectable } from '@nestjs/common';
import type { MemoryHealth } from '@repo/shared-types';

const MB = 1024 * 1024;

/**
 * 프로세스 메모리 진단.
 *
 * 왜 heap 이 아니라 RSS 를 기준으로 하는가?
 *  컨테이너 OOMKilled 판정은 cgroup 의 실제 메모리(≈RSS) 기준이다. heap 만 보면 Buffer/네이티브 메모리 누수를 놓친다.
 *  임계치는 k8s `resources.limits.memory` 보다 낮게(약 80%) 잡아 OOMKill 전에 Pod 를 트래픽에서 빼도록 한다.
 */
@Injectable()
export class MemoryHealthIndicator {
  check(rssThresholdMb: number): MemoryHealth {
    const { rss, heapUsed, heapTotal } = process.memoryUsage();
    const rssThresholdBytes = rssThresholdMb * MB;
    return {
      status: rss <= rssThresholdBytes ? 'up' : 'down',
      rssBytes: rss,
      heapUsedBytes: heapUsed,
      heapTotalBytes: heapTotal,
      rssThresholdBytes,
    };
  }
}
