import { type ArgumentsHost, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { CONTENT_TYPES, PROBLEM_TYPES, type ProblemDetails } from '@repo/shared-types';
import { RequestValidationException } from '../exceptions/problem.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface ReplyCall {
  body: ProblemDetails;
  status: number;
}

function createHarness(exposeInternalErrors = false) {
  const replies: ReplyCall[] = [];
  const headers = new Map<string, string>();
  const httpAdapterHost = {
    httpAdapter: {
      reply: (_res: unknown, body: ProblemDetails, status: number) => {
        replies.push({ body, status });
      },
      setHeader: (_res: unknown, name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      },
    },
  } as unknown as HttpAdapterHost;

  const request = { method: 'GET', originalUrl: '/api/v1/things', requestId: 'req-12345678' };
  const response = { headersSent: false, end: jest.fn() };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(httpAdapterHost, exposeInternalErrors);
  return { filter, host, replies, headers };
}

describe('AllExceptionsFilter', () => {
  // 의도된 에러 로그가 테스트 출력을 오염시키지 않도록
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('Nest HttpException 을 RFC 7807 로 변환한다', () => {
    const { filter, host, replies, headers } = createHarness();

    filter.catch(new NotFoundException('Thing not found'), host);

    expect(replies).toHaveLength(1);
    const [{ body, status }] = replies as [ReplyCall];
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body).toMatchObject({
      type: PROBLEM_TYPES.NOT_FOUND,
      title: 'Not Found',
      status: 404,
      detail: 'Thing not found',
      instance: '/api/v1/things',
      requestId: 'req-12345678',
    });
    expect(headers.get('content-type')).toBe(CONTENT_TYPES.PROBLEM_JSON);
  });

  it('검증 실패 시 필드 에러 목록을 포함한다', () => {
    const { filter, host, replies } = createHarness();

    filter.catch(
      new RequestValidationException([{ field: 'email', messages: ['email must be an email'] }]),
      host,
    );

    const [{ body }] = replies as [ReplyCall];
    expect(body.type).toBe(PROBLEM_TYPES.VALIDATION_FAILED);
    expect(body.errors).toEqual([{ field: 'email', messages: ['email must be an email'] }]);
  });

  it('unique 제약 위반(23505)을 409 로 승격한다', () => {
    const { filter, host, replies } = createHarness();
    const error = new QueryFailedError(
      'INSERT ...',
      [],
      Object.assign(new Error('dup'), { code: '23505' }),
    );

    filter.catch(error, host);

    const [{ status, body }] = replies as [ReplyCall];
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.detail).not.toContain('INSERT');
  });

  it('프로덕션에서는 알 수 없는 에러의 내부 메시지를 숨긴다', () => {
    const { filter, host, replies } = createHarness(false);

    filter.catch(new Error('password=hunter2 connection refused'), host);

    const [{ status, body }] = replies as [ReplyCall];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.detail).not.toContain('hunter2');
  });
});
