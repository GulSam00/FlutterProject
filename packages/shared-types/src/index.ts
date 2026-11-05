/**
 * @repo/shared-types
 *
 * 설계 원칙
 *  1. Zod 스키마가 단일 진실 공급원(SSOT)이다. TS 타입은 `z.infer` 로 파생시켜 "타입과 검증 로직이 어긋나는" 상황을 원천 차단한다.
 *  2. 이 패키지는 런타임 의존성을 zod 하나로 제한한다. (NestJS/React 등 프레임워크 의존 금지 → 어느 앱에서도 import 가능)
 *  3. 도메인 DTO 는 `src/<domain>.ts` 로 추가하고 여기서 re-export 한다.
 */
export * from './constants';
export * from './api-response';
export * from './health';
export * from './dart-mirrors';
