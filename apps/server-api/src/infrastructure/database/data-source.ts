import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from '../../config/env.validation';
import { buildDataSourceOptions } from './typeorm.options';

/**
 * TypeORM CLI(migration:generate / run / revert) 전용 DataSource.
 * 런타임과 동일한 env 검증 + 옵션 빌더를 재사용한다.
 * 빌드 산출물(dist) 기준으로 실행하므로 ts-node 가 필요 없다.
 */
const env = validateEnv(process.env);

export default new DataSource({
  ...buildDataSourceOptions(env),
  migrationsRun: false,
  entities: [`${__dirname}/../../modules/**/entities/*.entity.{js,ts}`],
});
