import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../infrastructure/database/base.entity';

/**
 * __Pascal__ 엔티티. **생성된 뼈대이므로 자리표시자 `name` 을 실제 컬럼으로 바꿀 것.**
 *
 * 이 파일의 위치(`modules/<domain>/entities/`)는 바꾸지 않는다.
 * 앱 런타임은 `forFeature()` 로 등록된 엔티티를 쓰지만, 마이그레이션 CLI(`data-source.ts`)는
 * 이 경로 패턴으로만 엔티티를 찾는다. 다른 위치에 두면 앱은 정상 동작하는데
 * `migration:generate` 가 빈 마이그레이션을 만들어 운영 DB 에 테이블이 생기지 않는다.
 *
 * `BaseEntity` 가 uuid PK, 생성·수정 시각, soft delete, 낙관적 락 version 을 제공한다.
 */
@Entity('__snakePlural__')
export class __Pascal__ extends BaseEntity {
  // 조회 조건으로 쓸 컬럼에는 인덱스를 둔다. 없으면 데이터가 늘수록 full scan 이 된다.
  @Index()
  @Column({ type: 'varchar', length: 200 })
  name!: string;
}
