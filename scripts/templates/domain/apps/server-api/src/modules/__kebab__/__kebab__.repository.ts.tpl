import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { __Pascal__ } from './entities/__kebab__.entity';

export interface Paged<T> {
  items: T[];
  total: number;
}

/**
 * __Pascal__ 저장소 계층.
 *
 * 규칙
 *  - 쿼리는 이 파일에만 둔다. Service 는 TypeORM 을 모른다. 저장소를 바꿀 때 고칠 곳이 한 곳으로 모인다.
 *  - Data Mapper 패턴을 쓴다 (`Repository<T>` 주입). 엔티티에 `save()` 를 붙이는 Active Record 방식은 쓰지 않는다.
 *  - HTTP 예외를 던지지 않는다. "없음" 은 `null` 로 돌려주고, 404 로 바꿀지는 Service 가 정한다.
 */
@Injectable()
export class __Pascal__Repository {
  constructor(
    @InjectRepository(__Pascal__)
    private readonly repository: Repository<__Pascal__>,
  ) {}

  /**
   * 목록과 전체 개수를 한 번에 가져온다.
   * `findAndCount` 는 두 쿼리를 보내지만 같은 조건을 두 곳에 적는 실수를 막는다.
   */
  async findPage(page: number, limit: number): Promise<Paged<__Pascal__>> {
    const [items, total] = await this.repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      // 정렬을 지정하지 않으면 DB 가 순서를 보장하지 않아, 페이지 간 항목이 중복·누락된다
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return { items, total };
  }

  findById(id: string): Promise<__Pascal__ | null> {
    return this.repository.findOne({ where: { id } });
  }

  create(data: Pick<__Pascal__, 'name'>): Promise<__Pascal__> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  /**
   * 부분 수정. 호출자가 이미 조회한 엔티티를 넘기므로 낙관적 락(version)이 동작한다.
   * `update(id, patch)` 를 쓰면 version 검사를 건너뛰어 동시 수정이 조용히 덮어써진다.
   */
  save(entity: __Pascal__): Promise<__Pascal__> {
    return this.repository.save(entity);
  }

  /** soft delete. `BaseEntity.deletedAt` 이 채워지고 기본 조회에서 제외된다. */
  async softDeleteById(id: string): Promise<boolean> {
    const result = await this.repository.softDelete({ id });
    return (result.affected ?? 0) > 0;
  }
}
