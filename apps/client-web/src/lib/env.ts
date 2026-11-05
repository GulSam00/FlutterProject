import { z } from 'zod';

/**
 * 환경변수 검증.
 *
 * ⚠️ NEXT_PUBLIC_* 는 "빌드 시점"에 클라이언트 번들에 문자열로 치환된다.
 *    따라서 `process.env.NEXT_PUBLIC_API_URL` 처럼 리터럴로 접근해야 하며(동적 키 접근 불가),
 *    Docker 이미지는 환경(dev/prod)마다 build-arg 로 다시 빌드해야 한다.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

const ServerEnvSchema = PublicEnvSchema.extend({
  // RSC → API 는 공인 도메인을 거치지 않고 클러스터 내부 DNS 로 직접 호출 (지연시간/egress 비용 절감)
  API_INTERNAL_URL: z.url(),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * 모듈 로드 시점에 검증한다. `NEXT_PUBLIC_*` 는 빌드할 때 번들에 박히므로 빌드 전에 있어야 한다.
 *
 * 그래서 값이 없으면 `next build` 가 실패하는 것이 맞다. 다만 Zod 원본 에러
 * ("Invalid input: expected string, received undefined")만 나오면 무엇을 해야 하는지 알 수 없다.
 * 새로 clone 한 사람이 가장 먼저 만나는 에러라서, 할 일을 메시지에 담는다.
 */
function parsePublicEnv(): PublicEnv {
  const result = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
  if (result.success) return result.data;

  const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(
    `환경변수가 없거나 올바르지 않습니다: ${missing}\n` +
      '  로컬: cp apps/client-web/.env.example apps/client-web/.env.local\n' +
      '  빌드·CI: NEXT_PUBLIC_API_URL 을 환경변수로 넘기세요 (빌드 시점에 번들에 인라인됩니다)',
  );
}

export const publicEnv: PublicEnv = parsePublicEnv();

/** 서버 전용. 호출 시점에 검증하여 빌드(정적 분석) 단계에서 런타임 전용 변수 누락으로 실패하지 않게 한다 */
export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
  });
}
