import { NotFoundException } from '@nestjs/common';
import type { __Pascal__ as __Pascal__Entity } from './entities/__kebab__.entity';
import type { __Pascal__Repository } from './__kebab__.repository';
import { __Pascal__Service } from './__kebab__.service';

/**
 * __Pascal__Service 테스트. **생성된 뼈대다. 실제 비즈니스 규칙을 추가하면 여기에 케이스를 더한다.**
 *
 * 저장소를 가짜로 바꿔서 DB 없이 돌린다. 검증 대상은 "저장소가 null 을 줄 때 404 로 바꾸는가",
 * "페이지 정보를 올바르게 계산하는가" 처럼 이 계층이 책임지는 판단이다.
 */
function entity(overrides: Partial<__Pascal__Entity> = {}): __Pascal__Entity {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'sample',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function createService(repository: Partial<__Pascal__Repository>): __Pascal__Service {
  // spec 파일의 mock 에는 `as unknown as` 를 허용한다 (루트 CLAUDE.md 금지 규칙의 예외)
  return new __Pascal__Service(repository as unknown as __Pascal__Repository);
}

describe('__Pascal__Service', () => {
  it('목록은 전체 페이지 수를 함께 반환한다', async () => {
    const service = createService({
      findPage: jest.fn().mockResolvedValue({ items: [entity()], total: 25 }),
    });

    const result = await service.findMany({ page: 2, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.pageInfo).toEqual({ page: 2, size: 10, totalItems: 25, totalPages: 3 });
  });

  it('결과가 없어도 totalPages 는 최소 1 이다 (0 페이지는 의미가 없다)', async () => {
    const service = createService({
      findPage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    });
    const result = await service.findMany({ page: 1, limit: 20 });
    expect(result.pageInfo.totalPages).toBe(1);
  });

  it('응답에 내부 컬럼(version, deletedAt)을 노출하지 않는다', async () => {
    const service = createService({ findById: jest.fn().mockResolvedValue(entity()) });
    const result = await service.findOne('00000000-0000-4000-8000-000000000001');
    expect(Object.keys(result).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt']);
  });

  it('없는 id 조회는 NotFoundException', async () => {
    const service = createService({ findById: jest.fn().mockResolvedValue(null) });
    await expect(service.findOne('00000000-0000-4000-8000-000000000009')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('없는 id 수정은 NotFoundException (저장을 시도하지 않는다)', async () => {
    const save = jest.fn();
    const service = createService({ findById: jest.fn().mockResolvedValue(null), save });
    await expect(
      service.update('00000000-0000-4000-8000-000000000009', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('수정은 조회한 엔티티를 저장한다 (낙관적 락이 동작하도록)', async () => {
    const found = entity();
    const save = jest.fn().mockImplementation((e: __Pascal__Entity) => Promise.resolve(e));
    const service = createService({ findById: jest.fn().mockResolvedValue(found), save });

    const result = await service.update(found.id, { name: 'changed' });

    expect(save).toHaveBeenCalledWith(found);
    expect(result.name).toBe('changed');
  });

  it('삭제 대상이 없으면 NotFoundException', async () => {
    const service = createService({ softDeleteById: jest.fn().mockResolvedValue(false) });
    await expect(service.remove('00000000-0000-4000-8000-000000000009')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
