import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DependencyHealth } from '@repo/shared-types';
import { DataSource } from 'typeorm';
import { type DependencyHealthIndicator, probeDependency } from './dependency-health.indicator';

/**
 * PostgreSQL 커넥션 진단.
 * 헬스 도메인에서 "데이터 접근 계층(Repository)" 역할을 담당한다 → Service 는 ORM 을 직접 알지 못한다.
 */
@Injectable()
export class DatabaseHealthIndicator implements DependencyHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(timeoutMs: number): Promise<DependencyHealth> {
    const result = await probeDependency(async () => {
      if (!this.dataSource.isInitialized) {
        throw new Error('DataSource is not initialized');
      }
      // 풀에서 실제 커넥션을 하나 빌려 왕복 → "풀은 있는데 DB 는 죽은" 상태까지 잡아낸다
      await this.dataSource.query('SELECT 1');
    }, timeoutMs);

    if (result.status === 'down') {
      this.logger.warn(`Database health check failed: ${result.message ?? 'unknown'}`);
    }
    return result;
  }
}
