// @ts-check
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node, ...globals.jest },
  },
  rules: {
    // Nest의 DI는 런타임 메타데이터(emitDecoratorMetadata)에 의존한다.
    // `import type`으로 바꾸면 메타데이터가 사라져 DI가 깨지므로 이 규칙은 끈다.
    '@typescript-eslint/consistent-type-imports': 'off',
    // 빈 Module 클래스(@Module({...}) export class XModule {})는 Nest의 관용구다.
    '@typescript-eslint/no-extraneous-class': 'off',
  },
});
