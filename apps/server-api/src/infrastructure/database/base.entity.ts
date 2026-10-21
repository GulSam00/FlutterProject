import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * 모든 도메인 엔티티의 공통 컬럼.
 * - uuid PK: 순차 ID 노출로 인한 리소스 열거(enumeration) 공격 방지 + 분산 환경에서 충돌 없는 ID
 * - version: 낙관적 락 → 동시 수정 시 "나중에 쓴 쪽이 조용히 덮어쓰는(lost update)" 문제 방지
 * - deletedAt: soft delete (감사/복구 대응)
 *
 * TypeORM 의 `BaseEntity`(Active Record) 를 상속하지 않는다. → Data Mapper 패턴 유지
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  @VersionColumn({ default: 1 })
  version!: number;
}
