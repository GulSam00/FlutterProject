import type { ValidationError } from 'class-validator';
import type { FieldError } from '@repo/shared-types';

/**
 * class-validator 의 중첩 ValidationError 트리를 평탄화한다.
 * { address: { children: [{ property: 'zipCode', ... }] } } → [{ field: 'address.zipCode', messages: [...] }]
 * 클라이언트 폼 라이브러리(react-hook-form 등)가 그대로 setError 할 수 있는 형태다.
 */
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    const nested = error.children?.length ? flattenValidationErrors(error.children, field) : [];
    return [...own, ...nested];
  });
}
