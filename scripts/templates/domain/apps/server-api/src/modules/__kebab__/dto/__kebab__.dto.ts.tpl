import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { __Pascal__ } from '@repo/shared-types';
import type { __Pascal__ as __Pascal__Entity } from '../entities/__kebab__.entity';

/**
 * __Pascal__ 요청·응답 DTO. **자리표시자 `name` 을 실제 필드로 바꿀 것.**
 *
 * 모든 필드에 class-validator 데코레이터가 필요하다.
 * `forbidNonWhitelisted: true` 라서 데코레이터가 없는 필드를 보낸 요청은 400 으로 거부된다.
 * (조용히 무시되는 것이 아니다 — 클라이언트가 보내는 필드를 빠뜨리면 그 요청 전체가 실패한다)
 */
export class Create__Pascal__Dto {
  @IsString()
  @Length(1, 200)
  name!: string;
}

/**
 * 부분 수정용. `@nestjs/mapped-types` 의 `PartialType` 을 쓰지 않고 직접 선언한다.
 * 의존성을 하나 줄이고, 어떤 필드가 optional 인지 파일만 읽어서 알 수 있다.
 */
export class Update__Pascal__Dto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}

/**
 * 목록 조회 쿼리.
 * `enableImplicitConversion: false` 이므로 쿼리스트링 숫자는 `@Type(() => Number)` 로 명시 변환해야 한다.
 */
export class Find__PascalPlural__Query {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  // 상한을 두지 않으면 `?limit=1000000` 한 번으로 DB 와 메모리를 고갈시킬 수 있다
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

/**
 * 엔티티를 그대로 응답하지 않고 이 함수를 거친다.
 * 엔티티를 직접 내보내면 내부 컬럼(soft delete 시각, version)이 노출되고,
 * 컬럼을 추가할 때마다 API 계약이 조용히 바뀐다.
 */
export function to__Pascal__Response(entity: __Pascal__Entity): __Pascal__ {
  return {
    id: entity.id,
    name: entity.name,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
