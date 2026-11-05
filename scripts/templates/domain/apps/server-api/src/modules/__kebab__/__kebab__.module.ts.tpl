import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { __Pascal__ } from './entities/__kebab__.entity';
import { __Pascal__Controller } from './__kebab__.controller';
import { __Pascal__Repository } from './__kebab__.repository';
import { __Pascal__Service } from './__kebab__.service';

/**
 * `forFeature` 가 이 엔티티의 `Repository<__Pascal__>` 를 주입 가능하게 만든다.
 * DatabaseModule 의 `autoLoadEntities` 가 여기 등록된 엔티티를 수집하므로,
 * 엔티티 목록을 두 곳에 적지 않아도 된다.
 *
 * Repository 를 `exports` 에 넣지 않았다. 다른 모듈이 이 도메인의 데이터를 쓸 때는
 * Service 를 export 해서 비즈니스 규칙을 거치게 한다 (저장소를 직접 쓰면 규칙을 우회한다).
 */
@Module({
  imports: [TypeOrmModule.forFeature([__Pascal__])],
  controllers: [__Pascal__Controller],
  providers: [__Pascal__Service, __Pascal__Repository],
  exports: [__Pascal__Service],
})
export class __Pascal__Module {}
