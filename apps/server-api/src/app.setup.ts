import { HttpStatus, type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { API_DEFAULT_VERSION, API_GLOBAL_PREFIX, HTTP_HEADERS } from '@repo/shared-types';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestValidationException } from './common/exceptions/problem.exception';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { flattenValidationErrors } from './common/utils/flatten-validation-errors';
import { type AppConfig, NodeEnv } from './config/env.validation';

/**
 * 전역 파이프/인터셉터/필터/미들웨어 바인딩.
 *
 * main.ts 에 직접 쓰지 않고 함수로 분리한 이유:
 *  e2e 테스트에서 `Test.createTestingModule()` 로 만든 앱에도 "운영과 완전히 동일한" 설정을 적용하기 위함.
 *  (운영에만 있는 필터 때문에 테스트는 통과하고 운영에서 응답 포맷이 다른 사고를 방지)
 */
export function setupApp(app: NestExpressApplication | INestApplication): void {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;

  // ── 프록시 신뢰 범위 ── X-Forwarded-For 위조로 req.ip 를 속이는 것을 막기 위해 홉 수를 명시
  if ('set' in app) {
    app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  }

  // ── 미들웨어 (라우팅 이전 단계) ──
  app.use(requestIdMiddleware);
  app.use(helmet());

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    exposedHeaders: [HTTP_HEADERS.REQUEST_ID],
    maxAge: 600,
  });

  // ── 라우팅: /api/v1/... ──
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });

  // ── 입력 검증 ──
  app.useGlobalPipes(
    new ValidationPipe({
      // DTO 에 선언되지 않은 필드 제거 → Mass Assignment (예: role=admin 주입) 차단
      whitelist: true,
      // 선언되지 않은 필드가 오면 아예 400 → 클라이언트 버그를 조기에 드러낸다
      forbidNonWhitelisted: true,
      // plain object → DTO 클래스 인스턴스 변환 (@Type 데코레이터 적용)
      transform: true,
      // 암묵적 형변환은 끈다. "abc" → NaN 같은 조용한 데이터 오염을 막고, 필요한 곳만 @Type 으로 명시
      transformOptions: { enableImplicitConversion: false },
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      exceptionFactory: (errors) => new RequestValidationException(flattenValidationErrors(errors)),
    }),
  );

  // ── 응답 / 에러 규격 ──
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost), !isProduction));

  // SIGTERM 수신 시 onModuleDestroy/onApplicationShutdown 훅 실행 → DB/Redis 커넥션 정상 종료
  app.enableShutdownHooks();
}
