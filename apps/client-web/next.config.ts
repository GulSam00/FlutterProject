import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker 런타임 이미지 경량화: 실행에 필요한 파일만 .next/standalone 으로 추출 (node_modules 전체 복사 불필요)
  output: 'standalone',
  // 모노레포 루트를 추적 기준으로 지정해야 workspace 패키지(@repo/shared-types)가 standalone 번들에 포함된다
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  // 서버 기술 스택 노출(X-Powered-By: Next.js) 제거 → 버전 기반 자동화 공격 표면 축소
  poweredByHeader: false,
  eslint: {
    // 린트는 turbo `lint` 태스크에서 독립 실행/캐싱한다. 빌드 단계 중복 실행 방지
    ignoreDuringBuilds: true,
  },
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]);
  },
};

export default nextConfig;
