/** DI 토큰: 문자열 대신 Symbol 을 사용해 다른 모듈의 토큰과 충돌하지 않게 한다 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
