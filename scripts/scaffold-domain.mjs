#!/usr/bin/env node
/**
 * 도메인 뼈대 생성기.
 *
 * `node scripts/scaffold-domain.mjs <name> [--plural <plural>] [--dry-run] [--force]`
 *   예) node scripts/scaffold-domain.mjs order        → order / orders
 *       node scripts/scaffold-domain.mjs category --plural categories
 *
 * 왜 LLM 이 아니라 생성기인가
 *   "같은 입력에 같은 구조" 가 요구사항이다. 매번 조금씩 다른 구조가 쌓이면 계층 규칙이 의미를 잃는다.
 *   생성기는 결과가 결정적이고, 템플릿이 낡았는지 `scripts/verify-scaffold.sh` 로 검증할 수 있다.
 *
 * 왜 plop 같은 의존성을 쓰지 않는가
 *   생성 대상이 TypeScript 3곳(shared-types, server, web)과 Dart 1곳이다.
 *   템플릿 엔진이 해 주는 일은 문자열 치환뿐이라, 의존성을 늘리는 값이 비용보다 작다.
 *
 * 이 생성기는 비즈니스 로직을 만들지 않는다. 필드는 `name` 하나뿐인 자리표시자이고,
 * 생성된 파일의 머리말 주석이 무엇을 바꿔야 하는지 알려준다.
 */
import { readdir, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const TEMPLATE_DIR = join(SCRIPT_DIR, 'templates', 'domain');

/** 등록 지점: 생성만으로는 앱이 새 도메인을 모른다. 이 두 곳에 한 줄씩 추가해야 연결된다. */
const REGISTRATIONS = [
  {
    file: 'packages/shared-types/src/index.ts',
    anchor: "export * from './health';",
    line: (n) => `export * from './${n.kebab}';`,
  },
  {
    file: 'apps/server-api/src/app.module.ts',
    // import 문은 마지막 import 뒤에 넣는다. `imports: [` 를 기준으로 삼으면
    // import 문이 배열 안에 들어가 파일이 깨진다 (실제로 겪었고, verify-scaffold.sh 가 잡아냈다).
    anchor: "import { HealthModule } from './modules/health/health.module';",
    line: (n) => `import { ${n.Pascal}Module } from './modules/${n.kebab}/${n.kebab}.module';`,
    // 모듈 등록은 imports 배열의 기존 항목 뒤에
    extra: {
      anchor: '    HealthModule,',
      line: (n) => `    ${n.Pascal}Module,`,
    },
  },
];

function fail(message) {
  process.stderr.write(`✖ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { name: undefined, plural: undefined, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--plural') {
      i += 1;
      args.plural = argv[i];
      if (!args.plural) fail('--plural 뒤에 값이 필요합니다.');
    } else if (arg.startsWith('-')) fail(`알 수 없는 옵션: ${arg}`);
    else if (args.name === undefined) args.name = arg;
    else fail(`인자가 너무 많습니다: ${arg}`);
  }
  if (!args.name) {
    fail(
      '사용법: node scripts/scaffold-domain.mjs <name> [--plural <plural>] [--dry-run] [--force]',
    );
  }
  return args;
}

/**
 * 영어 복수형은 불규칙이 많다. 흔한 규칙만 적용하고, 맞지 않으면 `--plural` 로 받는다.
 * 추측해서 `categorys` 같은 테이블명을 만드는 것보다 사용자가 지정하게 하는 편이 낫다.
 */
function pluralize(singular) {
  if (/(s|sh|ch|x|z)$/.test(singular)) return `${singular}es`;
  if (/[^aeiou]y$/.test(singular)) return `${singular.slice(0, -1)}ies`;
  return `${singular}s`;
}

/** kebab-case 입력을 각 언어의 관례에 맞는 표기로 바꾼다 */
function deriveNames(rawName, rawPlural) {
  // 소문자로 바꾼 뒤에 검사하면 `OrderItem` 이 `orderitem` 으로 조용히 통과한다.
  // 단어 경계를 잃은 이름은 Pascal·snake 표기가 전부 어긋나므로, 원본을 그대로 검사해서 거부한다.
  const kebab = rawName.trim();
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(kebab)) {
    fail(
      `이름은 kebab-case 여야 합니다 (예: order, order-item). 받은 값: "${rawName}"\n` +
        '  대문자가 섞여 있으면 단어 경계를 알 수 없어 Pascal·snake 표기가 어긋납니다.',
    );
  }
  const words = kebab.split('-');
  const lastPlural = rawPlural ? rawPlural.toLowerCase() : pluralize(words.at(-1));
  const pluralWords = rawPlural ? lastPlural.split('-') : [...words.slice(0, -1), lastPlural];

  const pascal = (parts) => parts.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  const camel = (parts) => parts[0] + pascal(parts.slice(1));

  return {
    kebab,
    camel: camel(words),
    Pascal: pascal(words),
    snake: words.join('_'),
    kebabPlural: pluralWords.join('-'),
    camelPlural: camel(pluralWords),
    PascalPlural: pascal(pluralWords),
    snakePlural: pluralWords.join('_'),
  };
}

function render(text, names) {
  // 키에 `_` 를 허용하면 `__snake___repository.dart` 에서 키가 `snake_` 로 잡힌다
  // (`\w` 가 밑줄을 포함해 뒤따르는 구분자까지 삼킨다). 키는 영문·숫자로만 제한한다.
  return text.replace(/__([A-Za-z][A-Za-z0-9]*)__/g, (match, key) => {
    if (!(key in names)) fail(`템플릿에 알 수 없는 자리표시자 ${match} 가 있습니다.`);
    return names[key];
  });
}

async function collectTemplates(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTemplates(full, base)));
    else files.push(relative(base, full));
  }
  return files.sort();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 등록 지점에 한 줄 추가. 이미 있으면 건드리지 않는다 (여러 번 실행해도 중복되지 않게). */
function insertAfter(content, anchor, line) {
  if (content.includes(line)) return { content, changed: false };
  const index = content.indexOf(anchor);
  if (index === -1) return { content, changed: false, missingAnchor: true };
  const insertAt = index + anchor.length;
  return {
    content: `${content.slice(0, insertAt)}\n${line}${content.slice(insertAt)}`,
    changed: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const names = deriveNames(args.name, args.plural);

  if (!(await exists(TEMPLATE_DIR))) fail(`템플릿 디렉터리가 없습니다: ${TEMPLATE_DIR}`);
  const templates = await collectTemplates(TEMPLATE_DIR);
  if (templates.length === 0) fail('템플릿 파일이 없습니다.');

  const planned = [];
  for (const templatePath of templates) {
    const targetPath = render(templatePath.replace(/\.tpl$/, ''), names);
    const absolute = join(REPO_ROOT, targetPath);
    if ((await exists(absolute)) && !args.force) {
      fail(`이미 존재합니다: ${targetPath}\n  덮어쓰려면 --force (기존 수정이 사라집니다)`);
    }
    const body = render(await readFile(join(TEMPLATE_DIR, templatePath), 'utf8'), names);
    planned.push({ targetPath, absolute, body });
  }

  const warnings = [];
  const registrationEdits = [];
  for (const reg of REGISTRATIONS) {
    const absolute = join(REPO_ROOT, reg.file);
    if (!(await exists(absolute))) {
      warnings.push(`등록 지점 파일이 없습니다: ${reg.file}`);
      continue;
    }
    let content = await readFile(absolute, 'utf8');
    let touched = false;
    for (const step of [reg, reg.extra].filter(Boolean)) {
      const result = insertAfter(content, step.anchor, step.line(names));
      if (result.missingAnchor) {
        warnings.push(
          `${reg.file}: 기준 문구를 찾지 못해 수동 등록이 필요합니다 → ${step.line(names)}`,
        );
        continue;
      }
      content = result.content;
      touched = touched || result.changed;
    }
    if (touched) registrationEdits.push({ file: reg.file, absolute, content });
  }

  const label = args.dryRun ? '생성 예정' : '생성';
  process.stdout.write(`${names.Pascal} (${names.kebabPlural}) 도메인 ${label}\n\n`);
  for (const { targetPath } of planned) process.stdout.write(`  + ${targetPath}\n`);
  for (const { file } of registrationEdits) process.stdout.write(`  ~ ${file}\n`);

  if (!args.dryRun) {
    for (const { absolute, body } of planned) {
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, body, 'utf8');
    }
    for (const { absolute, content } of registrationEdits) {
      await writeFile(absolute, content, 'utf8');
    }
  }

  if (warnings.length > 0) {
    process.stdout.write('\n⚠ 확인이 필요합니다\n');
    for (const warning of warnings) process.stdout.write(`  - ${warning}\n`);
  }

  process.stdout.write(`
다음 단계
  1. 생성된 파일의 머리말 주석을 읽고 자리표시자 필드(\`name\`)를 실제 필드로 바꾼다
  2. packages/shared-types 빌드:  pnpm --filter @repo/shared-types build
  3. 마이그레이션 생성:           pnpm infra:up && pnpm --filter @app/server-api migration:generate \\
                                   src/infrastructure/database/migrations/Create${names.PascalPlural}
  4. 검증:                        pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
                                  pnpm mobile:analyze && pnpm mobile:test
`);
}

await main();
