import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // DOM 이 필요 없는 테스트만 둔다 (API 클라이언트·쿼리 계약).
    // 컴포넌트 렌더링 테스트를 추가할 때 jsdom 과 @testing-library 를 함께 들인다.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // CI 로그에서 어떤 테스트가 느린지 바로 보이게 한다
    reporters: ['default'],
  },
  resolve: {
    alias: {
      // tsconfig 의 "@/*" 경로 별칭과 같은 매핑. 둘이 어긋나면 테스트만 모듈을 못 찾는다.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
