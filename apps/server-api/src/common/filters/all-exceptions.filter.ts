import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import {
  CONTENT_TYPES,
  HTTP_HEADERS,
  PROBLEM_TYPES,
  type ProblemDetails,
  type ProblemType,
} from '@repo/shared-types';
import { ProblemException } from '../exceptions/problem.exception';

/** HTTP status → 기본 problem type 매핑 (명시적 ProblemException 이 아닐 때 사용) */
const STATUS_TO_PROBLEM_TYPE: Partial<Record<number, ProblemType>> = {
  [HttpStatus.BAD_REQUEST]: PROBLEM_TYPES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: PROBLEM_TYPES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: PROBLEM_TYPES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: PROBLEM_TYPES.NOT_FOUND,
  [HttpStatus.CONFLICT]: PROBLEM_TYPES.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: PROBLEM_TYPES.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: PROBLEM_TYPES.SERVICE_UNAVAILABLE,
};

/** PostgreSQL SQLSTATE 코드 중 클라이언트 책임(4xx)으로 분류할 수 있는 것들 */
const PG_ERROR_TO_STATUS: Record<string, HttpStatus> = {
  '23505': HttpStatus.CONFLICT, // unique_violation
  '23503': HttpStatus.CONFLICT, // foreign_key_violation
  '22P02': HttpStatus.BAD_REQUEST, // invalid_text_representation (예: 잘못된 uuid)
};

interface PostgresDriverError {
  code?: string;
}

type ProblemBody = Omit<ProblemDetails, 'status'> & { status: number };

/**
 * 전역 예외 필터 — 모든 에러를 RFC 7807 `application/problem+json` 으로 정규화한다.
 *
 * 운영 리스크 예방 포인트
 *  1. 정보 노출 차단: 예상치 못한 에러(5xx)는 클라이언트에 내부 메시지/스택/SQL 을 절대 보내지 않는다.
 *     상세 내용은 서버 로그에만 남기고, 클라이언트는 requestId 로 추적한다.
 *  2. 응답 규격 일관성: 어떤 계층(Guard, Pipe, Service, ORM)에서 터져도 클라이언트는 하나의 파서만 유지하면 된다.
 *  3. 플랫폼 독립: HttpAdapterHost 를 사용해 Express → Fastify 전환 시에도 필터를 수정할 필요가 없다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly exposeInternalErrors: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // HTTP 이외 컨텍스트(향후 WebSocket/RPC)는 각 전용 필터가 처리하도록 위임
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const problem = this.toProblem(exception);
    const body: ProblemBody = {
      ...problem,
      instance: request.originalUrl,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    };

    this.log(exception, body, request);

    if (response.headersSent) {
      // 스트리밍 도중 에러: 이미 헤더가 나갔으므로 소켓을 정리하는 것 외엔 할 수 있는 게 없다
      response.end();
      return;
    }

    httpAdapter.setHeader(response, 'Content-Type', CONTENT_TYPES.PROBLEM_JSON);
    if (request.requestId) {
      httpAdapter.setHeader(response, HTTP_HEADERS.REQUEST_ID, request.requestId);
    }
    httpAdapter.reply(response, body, body.status);
  }

  private toProblem(exception: unknown): ProblemBody {
    // 1) 애플리케이션이 의도적으로 던진 예외 → 그대로 신뢰
    if (exception instanceof ProblemException) {
      const { type, title, status, detail, errors, details } = exception.problem;
      return { type, title, status, detail, errors, details };
    }

    // 2) Nest 표준 HttpException (NotFoundException, ForbiddenException, 라우트 404 등)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        type: STATUS_TO_PROBLEM_TYPE[status] ?? PROBLEM_TYPES.INTERNAL_SERVER_ERROR,
        title: this.statusTitle(status),
        status,
        detail: this.extractHttpExceptionMessage(exception),
      };
    }

    // 3) ORM 제약 조건 위반 → 4xx 로 승격 (그 외 DB 에러는 5xx 로 은닉)
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as PostgresDriverError).code;
      const mapped = code ? PG_ERROR_TO_STATUS[code] : undefined;
      if (mapped) {
        return {
          type: STATUS_TO_PROBLEM_TYPE[mapped] ?? PROBLEM_TYPES.BAD_REQUEST,
          title: this.statusTitle(mapped),
          status: mapped,
          detail:
            mapped === HttpStatus.CONFLICT
              ? 'The request conflicts with the current state of the resource.'
              : 'The request contains an invalid value.',
        };
      }
    }

    // 4) 알 수 없는 에러 → 내부 정보 은닉
    return {
      type: PROBLEM_TYPES.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail:
        this.exposeInternalErrors && exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred. Please contact support with the requestId.',
    };
  }

  private extractHttpExceptionMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && 'message' in res) {
      const { message } = res;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('; ');
    }
    return exception.message;
  }

  private statusTitle(status: number): string {
    // HttpStatus enum 의 역매핑: 404 → 'NOT_FOUND' → 'Not Found'
    const key = (HttpStatus as unknown as Record<number, string | undefined>)[status];
    if (!key) return 'Error';
    return key
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private log(exception: unknown, body: ProblemBody, request: Request): void {
    const context = `${request.method} ${request.originalUrl} → ${body.status} [${body.requestId ?? '-'}]`;
    // "예상치 못한" 에러(HttpException 이 아닌 것)만 스택과 함께 error 로 남긴다.
    // 의도적으로 던진 예외(4xx, 헬스체크 503 등)까지 error+stack 으로 남기면
    // probe 주기마다 로그가 쌓여 알람 피로도 → 진짜 장애를 놓친다.
    const isUnexpected = !(exception instanceof HttpException);
    if (isUnexpected && body.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${context} ${body.title}`, stack);
    } else {
      this.logger.warn(`${context} ${body.detail ?? body.title}`);
    }
  }
}
