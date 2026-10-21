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

export const publicEnv: PublicEnv = PublicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

/** 서버 전용. 호출 시점에 검증하여 빌드(정적 분석) 단계에서 런타임 전용 변수 누락으로 실패하지 않게 한다 */
export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL,
  });
}
