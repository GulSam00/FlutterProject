import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // 컨테이너/k8s 에서는 환경변수가 주입되므로 .env 파일이 없어도 동작해야 한다
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    // ── Infrastructure ──
    DatabaseModule,
    RedisModule,
    // ── Feature modules (새 도메인은 여기에 추가) ──
    HealthModule,
  ],
})
export class AppModule {}
