import { publicEnv } from '../env';
import { createApiClient } from './api-client';

/** 브라우저(클라이언트 컴포넌트)용 API 클라이언트. 공개 도메인을 통해 호출한다. */
export const browserApiClient = createApiClient({
  origin: publicEnv.NEXT_PUBLIC_API_URL,
  // 쿠키 기반 인증 도입 시를 대비 (CORS credentials: true 와 짝)
  defaultHeaders: {},
});
