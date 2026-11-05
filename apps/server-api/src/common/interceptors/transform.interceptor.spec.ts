import { type CallHandler, type ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { createExecutionContext } from '../../test-support/nest-context';
import { TransformInterceptor } from './transform.interceptor';

function createContext(): ExecutionContext {
  // 인터셉터는 originalUrl 과 requestId 만 읽는다. 전체 Request 를 만들 필요가 없다.
  return createExecutionContext({
    request: { originalUrl: '/api/v1/health', requestId: 'req-12345678' },
  });
}

const handlerOf = <T>(value: T): CallHandler<T> => ({ handle: () => of(value) });

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor<unknown>(new Reflector());

  it('반환값을 ApiResponse 규격으로 래핑한다', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(createContext(), handlerOf({ ok: 1 })),
    );

    expect(result).toMatchObject({
      success: true,
      data: { ok: 1 },
      meta: { requestId: 'req-12345678', path: '/api/v1/health' },
    });
  });

  it('undefined 를 null 로 정규화한다', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(createContext(), handlerOf(undefined)),
    );
    expect(result).toMatchObject({ success: true, data: null });
  });

  it('StreamableFile 은 래핑하지 않는다', async () => {
    const file = new StreamableFile(Buffer.from('x'));
    const result = await firstValueFrom(interceptor.intercept(createContext(), handlerOf(file)));
    expect(result).toBe(file);
  });
});
