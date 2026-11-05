import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import type { AppConfig } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 프로덕션: 한 줄 JSON 로그 → Loki/CloudWatch/Datadog 등이 필드 단위로 파싱 (ANSI 색상 코드 오염 방지)
    // ConfigModule 로딩 이전 시점이므로 process.env 를 직접 참조한다
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
      colors: process.env.NODE_ENV !== 'production',
    }),
  });

  // 전역 Pipe(ValidationPipe) / Interceptor(TransformInterceptor) / Filter(AllExceptionsFilter) 바인딩
  setupApp(app);

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  // 컨테이너 내부에서는 0.0.0.0 으로 바인딩해야 외부(다른 컨테이너/Service)에서 접근 가능
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `🚀 server-api listening on :${port} (env=${config.get('NODE_ENV', { infer: true })})`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  // 부팅 실패(환경변수 오류, DB 접속 불가 등)는 명확히 로그를 남기고 non-zero 로 종료 → 오케스트레이터가 감지
  Logger.error(error instanceof Error ? error.stack : String(error), 'Bootstrap');
  process.exit(1);
});
