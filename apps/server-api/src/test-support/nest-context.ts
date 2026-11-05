import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';

/**
 * Nest 의 HTTP 컨텍스트 테스트 더블.
 *
 * 왜 `partialMock` 을 쓰지 않는가
 *   `ExecutionContext.getType<TContext extends string>()`, `getClass<T>()`, `getRequest<T>()` 처럼
 *   이 인터페이스들의 메서드는 제네릭이다. `Partial<T>` 로는 구체 반환값을 가진 구현을 할당할 수 없다
 *   (`'http'` 는 `TContext` 에 할당 불가). 그래서 `Partial` 검사가 애초에 성립하지 않는다.
 *
 * 대신 필요한 단언을 이 파일 한 곳에 모았다. 각 spec 이 제 나름의 캐스팅을 반복하는 것보다
 *   - 왜 단언이 필요한지 설명이 한 번만 있고,
 *   - Nest 를 올려 인터페이스가 바뀌면 여기서만 깨지고,
 *   - spec 은 "무엇을 테스트하는가" 만 남는다.
 *
 * 쓰는 곳: `*.spec.ts` 전용.
 */

export interface HttpContextParts {
  /** 핸들러가 읽는 필드만 담으면 된다 (예: originalUrl, requestId) */
  request: object;
  response?: object;
  /** `@SetMetadata` 를 읽는 Reflector 테스트용 */
  handler?: () => unknown;
  controllerClass?: new (...args: never[]) => object;
}

function httpArgumentsHost({ request, response }: HttpContextParts) {
  return {
    getRequest: () => request,
    getResponse: () => response ?? {},
    getNext: () => undefined,
  };
}

export function createExecutionContext(parts: HttpContextParts): ExecutionContext {
  const context = {
    getType: () => 'http',
    getHandler: () => parts.handler ?? (() => undefined),
    getClass: () => parts.controllerClass ?? class TestController {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => httpArgumentsHost(parts),
    switchToRpc: () => undefined,
    switchToWs: () => undefined,
  };
  // 제네릭 시그니처 때문에 구조적 할당이 불가능하다 (위 주석 참조)
  return context as unknown as ExecutionContext;
}

export function createArgumentsHost(parts: HttpContextParts): ArgumentsHost {
  const host = {
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => httpArgumentsHost(parts),
    switchToRpc: () => undefined,
    switchToWs: () => undefined,
  };
  return host as unknown as ArgumentsHost;
}

export interface CapturedReply<TBody> {
  body: TBody;
  status: number;
}

export interface AdapterHarness<TBody> {
  httpAdapterHost: HttpAdapterHost;
  replies: CapturedReply<TBody>[];
  /** 소문자 키로 저장된 응답 헤더 */
  headers: Map<string, string>;
}

/**
 * `httpAdapter.reply`/`setHeader` 호출을 기록하는 어댑터 더블.
 * 필터가 "무엇을 어떤 상태 코드로 보냈는가" 를 검사할 수 있게 한다.
 */
export function createAdapterHarness<TBody>(): AdapterHarness<TBody> {
  const replies: CapturedReply<TBody>[] = [];
  const headers = new Map<string, string>();
  const httpAdapterHost = {
    httpAdapter: {
      reply: (_res: unknown, body: TBody, status: number) => {
        replies.push({ body, status });
      },
      setHeader: (_res: unknown, name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      },
    },
  };
  return {
    // HttpAdapterHost 는 AbstractHttpAdapter 전체를 요구한다. 필터가 쓰는 두 메서드만 구현한다.
    httpAdapterHost: httpAdapterHost as unknown as HttpAdapterHost,
    replies,
    headers,
  };
}
