import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * 표준 응답 래핑(TransformInterceptor) 을 건너뛴다.
 * 파일 다운로드, SSE, 외부 Webhook 규격처럼 응답 형태가 정해진 엔드포인트에서 사용한다.
 */
export const SkipTransform = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_TRANSFORM_KEY, true);
