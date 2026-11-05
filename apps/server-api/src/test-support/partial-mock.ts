/**
 * 테스트 더블 헬퍼.
 *
 * 왜 필요한가
 *   `{ check: jest.fn() } as unknown as DatabaseHealthIndicator` 는 `unknown` 을 거치면서
 *   타입 검사를 완전히 끈다. 대상 클래스의 메서드 이름이 바뀌거나 시그니처가 달라져도
 *   mock 은 그대로 컴파일되고, 테스트는 통과한 채 실제 코드만 깨진다.
 *
 * 이 헬퍼는 단언을 한 곳(`impl as T`)으로 모으고, 호출 지점에서는 `Partial<T>` 로 검사받게 한다.
 *   - `T` 에 없는 키를 넣으면 컴파일 에러
 *   - 시그니처가 맞지 않는 구현을 넣으면 컴파일 에러
 *   - `unknown` 을 거치지 않으므로 `Partial<T> → T` 범위의 단언만 쓴다
 *
 * 채우지 않은 멤버는 `undefined` 다. 테스트가 그걸 호출하면 TypeError 로 바로 터진다.
 * 자동 mock 처럼 조용히 `undefined` 를 반환하는 것보다, 무엇을 stub 하지 않았는지 즉시 드러나는 편이 낫다.
 *
 * 쓰는 곳: `*.spec.ts` 전용. 프로덕션 코드에서는 쓰지 않는다.
 */
export function partialMock<T extends object>(impl: Partial<T>): T {
  return impl as T;
}
