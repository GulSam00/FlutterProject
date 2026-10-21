import { HttpException, HttpStatus } from '@nestjs/common';
import { type FieldError, PROBLEM_TYPES, type ProblemType } from '@repo/shared-types';

export interface ProblemExceptionOptions {
  type: ProblemType;
  title: string;
  status: HttpStatus;
  detail?: string;
  errors?: FieldError[];
  details?: unknown;
}

/**
 * RFC 7807 문제 정보를 "명시적으로" 실어 나르는 애플리케이션 예외의 베이스.
 * 새 도메인을 추가할 때는 이 클래스를 상속해 `type` URI 를 고정하면,
 * AllExceptionsFilter 수정 없이 일관된 에러 응답이 만들어진다 (OCP).
 */
export class ProblemException extends HttpException {
  public readonly problem: ProblemExceptionOptions;

  constructor(options: ProblemExceptionOptions) {
    super(options.detail ?? options.title, options.status);
    this.problem = options;
  }
}

/** ValidationPipe 실패 전용 예외 (필드 단위 에러 포함) */
export class RequestValidationException extends ProblemException {
  constructor(errors: FieldError[]) {
    super({
      type: PROBLEM_TYPES.VALIDATION_FAILED,
      title: 'Validation Failed',
      status: HttpStatus.BAD_REQUEST,
      detail: 'One or more fields failed validation.',
      errors,
    });
  }
}
