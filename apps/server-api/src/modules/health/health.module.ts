import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { MemoryHealthIndicator } from './indicators/memory.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator, MemoryHealthIndicator],
})
export class HealthModule {}
