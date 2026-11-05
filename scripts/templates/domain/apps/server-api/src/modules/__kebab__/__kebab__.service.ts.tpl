import { Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated, __Pascal__ } from '@repo/shared-types';
import {
  type Create__Pascal__Dto,
  type Find__PascalPlural__Query,
  to__Pascal__Response,
  type Update__Pascal__Dto,
} from './dto/__kebab__.dto';
import { __Pascal__Repository } from './__kebab__.repository';

/**
 * __Pascal__ 비즈니스 규칙.
 *
 * 규칙
 *  - HTTP 객체(Request/Response)를 모른다. 그래야 다른 진입점(스케줄러, 큐 소비자)에서 그대로 쓸 수 있다.
 *  - 쿼리를 직접 쓰지 않는다. Repository 를 통한다.
 *  - 응답 변환은 `to__Pascal__Response` 로 한다. 엔티티를 그대로 내보내면 내부 컬럼이 노출된다.
 */
@Injectable()
export class __Pascal__Service {
  constructor(private readonly repository: __Pascal__Repository) {}

  async findMany(query: Find__PascalPlural__Query): Promise<Paginated<__Pascal__>> {
    const { page, limit } = query;
    const { items, total } = await this.repository.findPage(page, limit);
    return {
      items: items.map(to__Pascal__Response),
      pageInfo: {
        page,
        // 필드 이름은 `PageInfoSchema`(packages/shared-types/src/api-response.ts)를 따른다
        size: limit,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<__Pascal__> {
    const entity = await this.repository.findById(id);
    // 저장소는 null 을 돌려준다. "없음" 을 404 로 바꾸는 판단은 이 계층의 책임이다.
    if (!entity) throw new NotFoundException(`__Pascal__ ${id} not found`);
    return to__Pascal__Response(entity);
  }

  async create(dto: Create__Pascal__Dto): Promise<__Pascal__> {
    const entity = await this.repository.create({ name: dto.name });
    return to__Pascal__Response(entity);
  }

  async update(id: string, dto: Update__Pascal__Dto): Promise<__Pascal__> {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundException(`__Pascal__ ${id} not found`);
    // 조회한 엔티티를 수정해서 저장한다 → version 컬럼으로 동시 수정이 감지된다
    if (dto.name !== undefined) entity.name = dto.name;
    const saved = await this.repository.save(entity);
    return to__Pascal__Response(saved);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.softDeleteById(id);
    if (!deleted) throw new NotFoundException(`__Pascal__ ${id} not found`);
  }
}
