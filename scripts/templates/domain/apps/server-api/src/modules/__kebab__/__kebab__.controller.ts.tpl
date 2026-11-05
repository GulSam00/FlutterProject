import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Paginated, __Pascal__ } from '@repo/shared-types';
import {
  Create__Pascal__Dto,
  Find__PascalPlural__Query,
  Update__Pascal__Dto,
} from './dto/__kebab__.dto';
import { __Pascal__Service } from './__kebab__.service';

/**
 * __Pascal__ REST 엔드포인트. 경로는 `/api/v1/__kebabPlural__` 이다 (prefix·버전은 전역 설정).
 *
 * 컨트롤러는 HTTP 관심사만 다룬다: 경로, 상태 코드, 입력 바인딩.
 * 비즈니스 판단은 Service 에 있고, 응답을 `{success, data, meta}` 로 감싸는 것은 TransformInterceptor 가 한다.
 * 여기서 직접 감싸면 응답이 이중으로 포장된다.
 */
@Controller('__kebabPlural__')
export class __Pascal__Controller {
  constructor(private readonly service: __Pascal__Service) {}

  @Get()
  findMany(@Query() query: Find__PascalPlural__Query): Promise<Paginated<__Pascal__>> {
    return this.service.findMany(query);
  }

  /**
   * `ParseUUIDPipe` 로 형식을 먼저 걸러낸다.
   * 없으면 잘못된 문자열이 DB 까지 가서 Postgres `22P02` 오류가 되고, 그건 400 이 아니라 500 처럼 보인다.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<__Pascal__> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: Create__Pascal__Dto): Promise<__Pascal__> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update__Pascal__Dto,
  ): Promise<__Pascal__> {
    return this.service.update(id, dto);
  }

  // 삭제 성공은 돌려줄 본문이 없다. 204 로 응답하면 클라이언트가 빈 본문을 파싱하려 하지 않는다.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
