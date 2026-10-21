import 'server-only';
import { getServerEnv } from '../env';
import { type ApiClient, createApiClient } from './api-client';

/**
 * 서버 컴포넌트 / Route Handler 전용 API 클라이언트.
 * `server-only` import 로 클라이언트 번들에 실수로 포함되면 빌드가 실패한다 → 내부망 주소 유출 방지.
 */
export function getServerApiClient(): ApiClient {
  return createApiClient({
    origin: getServerEnv().API_INTERNAL_URL,
    // RSC 렌더링은 사용자가 화면을 기다리는 시간이므로 더 짧게
    defaultTimeoutMs: 5_000,
  });
}
