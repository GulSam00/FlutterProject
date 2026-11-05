/**
 * __Pascal__ 도메인의 API 계약. **생성된 뼈대이므로 아래를 실제 도메인에 맞게 바꿀 것.**
 *
 * 바꿀 곳
 *  - `__Pascal__Schema`: 자리표시자 `name` 필드를 실제 필드로 교체
 *  - `Create__Pascal__Schema`: 생성 시 클라이언트가 보낼 수 있는 필드만 남긴다 (id·타임스탬프는 서버가 만든다)
 *
 * 이 파일이 계약의 단일 진실 공급원이다. 서버 DTO, 웹 Zod 검증, Dart 모델이 모두 여기를 따라야 한다.
 * Dart 모델은 자동 생성되지 않는 손 사본이므로, 이 파일을 고치면 같은 커밋에서 Dart 쪽도 고친다.
 */
import { z } from 'zod';

export const __Pascal__Schema = z.object({
  id: z.uuid(),
  /** 자리표시자. 실제 필드로 교체할 것. */
  name: z.string().min(1).max(200),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type __Pascal__ = z.infer<typeof __Pascal__Schema>;

/** 생성 요청 바디. 서버가 정하는 값(id, 타임스탬프)은 받지 않는다. */
export const Create__Pascal__Schema = __Pascal__Schema.pick({ name: true });
export type Create__Pascal__Input = z.infer<typeof Create__Pascal__Schema>;

/** 수정 요청 바디. 부분 수정(PATCH)이므로 모든 필드가 optional 이다. */
export const Update__Pascal__Schema = Create__Pascal__Schema.partial();
export type Update__Pascal__Input = z.infer<typeof Update__Pascal__Schema>;
