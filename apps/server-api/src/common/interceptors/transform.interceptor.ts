import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import type { ApiResponse } from '@repo/shared-types';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

/**
 * 성공 응답을 `ApiResponse<T>` 표준 규격으로 래핑한다.
 *
 * - 컨트롤러는 순수 도메인 데이터만 반환하고, 전송 포맷(envelope)은 이 계층이 책임진다 (관심사 분리).
 * - `undefined` 는 JSON 직렬화 시 키 자체가 사라지므로 `null` 로 정규화한다.
 *   → 클라이언트의 `data` 필드 존재 가정이 깨지지 않도록 계약을 보장.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T | null> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T | null> | T> {
    if (context.getType() !== 'http' || this.shouldSkip(context)) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data): ApiResponse<T | null> | T => {
        // 파일 스트림은 래핑하면 안 된다
        if (data instanceof StreamableFile) return data;

        return {
          success: true,
          data: data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.requestId ?? 'unknown',
            path: request.originalUrl,
          },
        };
      }),
    );
  }

  private shouldSkip(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(SKIP_TRANSFORM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
