#!/usr/bin/env node
/**
 * Dart 모델이 Zod 계약과 어긋났는지 검사한다.
 *
 * `node scripts/check-dart-contract.mjs`   (전제: pnpm --filter @repo/shared-types build)
 *
 * 왜 코드 생성이 아니라 검사인가
 *   실제 위험은 "Dart 를 쓰는 일" 이 아니라 "Zod 를 고치고 Dart 를 잊는 일" 이다.
 *   손으로 쓴 Dart 모델은 패턴 매칭으로 구조를 검증하고 어긋나면 FormatException 을 던진다.
 *   생성된 코드로 바꾸면 그 동작을 다시 만들어야 하고, build_runner 같은 도구가 더 붙는다.
 *   검사만 두면 비용은 이 파일 하나이고, 막는 사고는 같다.
 *   (대안 비교는 docs/temp/decision-log.md 에 기록)
 *
 * 검사 방법
 *   1. `DART_MIRRORED_CONTRACTS` 의 각 스키마를 JSON Schema 로 변환해 최상위 필드 이름을 얻는다
 *   2. 대응하는 Dart 클래스가 **실제로 읽는 JSON 키**를 추출한다
 *      (`'key': final ...` 패턴 매칭과 `map['key']` 접근 두 가지)
 *   3. 양쪽을 비교해 누락·잉여를 보고한다
 *
 * 한계
 *   Dart 를 정식으로 파싱하지 않는다. 이 저장소의 모델이 지키는 두 가지 작성 관례에 의존한다.
 *   관례를 벗어나면 거짓 실패가 날 수 있고, 그때는 MIRRORS 의 매핑이나 모델 작성 방식을 맞춘다.
 *   타입까지는 보지 않는다 (`String` vs `int`). 필드 이름과 존재 여부만 본다.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * 계약 → Dart 사본 매핑.
 * `class`: Dart 클래스 이름. 그 클래스 본문에서 키를 추출한다.
 */
const MIRRORS = [
  {
    contract: 'ResponseMeta',
    file: 'apps/client-mobile/lib/core/network/api_response.dart',
    class: 'ResponseMeta',
  },
  {
    contract: 'FieldError',
    file: 'apps/client-mobile/lib/core/network/api_response.dart',
    class: 'FieldError',
  },
  {
    contract: 'ProblemDetails',
    file: 'apps/client-mobile/lib/core/network/api_response.dart',
    class: 'ProblemDetails',
  },
  {
    contract: 'DependencyHealth',
    file: 'apps/client-mobile/lib/features/health/domain/health_report.dart',
    class: 'DependencyHealth',
  },
  {
    contract: 'MemoryHealth',
    file: 'apps/client-mobile/lib/features/health/domain/health_report.dart',
    class: 'MemoryHealth',
  },
  {
    contract: 'HealthCheckResult',
    file: 'apps/client-mobile/lib/features/health/domain/health_report.dart',
    class: 'HealthReport',
  },
  {
    // 중첩 객체도 사본이 따로 있으면 검사한다. `path` 로 계약 안쪽을 지정한다.
    contract: 'HealthCheckResult',
    path: ['components'],
    file: 'apps/client-mobile/lib/features/health/domain/health_report.dart',
    class: 'HealthComponents',
    // HealthComponents 는 생성자로만 값을 받고 JSON 키를 직접 읽지 않는다.
    // 실제 파싱은 최상위 함수 _parseComponents 가 한다.
    keysFrom: '_parseComponents',
  },
  {
    // 모바일은 liveness 를 호출하지 않는다. 사본이 없다는 사실 자체를 기록해 둔다
    // (나중에 추가할 때 이 줄을 매핑으로 바꾸면 바로 검사 대상이 된다).
    contract: 'LivenessResult',
    skip: '모바일에 사본 없음 (liveness 는 K8s probe 전용)',
  },
];

/**
 * 클래스 본문을 중괄호 짝을 세어 잘라낸다.
 *
 * "다음 class 선언까지" 로 자르면 클래스 뒤에 온 최상위 함수까지 본문에 섞인다.
 * 그러면 그 함수가 읽는 키(예: `_parseComponents` 의 database/redis/memory)가
 * 이 클래스의 키로 오인되어 거짓 실패가 난다. 실제로 그렇게 실패해서 이 방식으로 바꿨다.
 */
function extractClassBody(source, className) {
  const declaration = new RegExp(`(?:final |abstract |sealed )*class ${className}[\\s<{]`);
  const match = declaration.exec(source);
  if (!match) return undefined;

  const open = source.indexOf('{', match.index);
  if (open === -1) return undefined;

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return undefined;
}

/** 최상위 함수 본문을 중괄호 짝으로 잘라낸다 (파싱을 클래스 밖 함수가 담당하는 경우) */
function extractFunctionBody(source, functionName) {
  const match = new RegExp(`\\b${functionName}\\s*\\(`).exec(source);
  if (!match) return undefined;
  const open = source.indexOf('{', match.index);
  if (open === -1) return undefined;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return undefined;
}

/** JSON Schema 에서 `path`(예: ['components'])를 따라 내려간 객체의 속성 이름들 */
function propertiesAt(jsonSchema, path = []) {
  let node = jsonSchema;
  for (const segment of path) {
    node = node?.properties?.[segment];
    // optional 필드는 anyOf: [실제 스키마, {not:{}}] 형태로 나올 수 있다
    if (node?.anyOf) node = node.anyOf.find((candidate) => candidate?.properties) ?? node;
  }
  return new Set(Object.keys(node?.properties ?? {}));
}

/** 본문에서 읽는 JSON 키 추출: `'key':` (패턴 매칭) 과 `['key']` (맵 접근) */
function extractJsonKeys(body) {
  const keys = new Set();
  for (const match of body.matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g)) keys.add(match[1]);
  for (const match of body.matchAll(/\[\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*\]/g)) keys.add(match[1]);
  return keys;
}

async function main() {
  // 빌드된 dist 를 읽는다. src 를 읽으면 ts 런타임이 필요해진다.
  const sharedTypesDist = join(REPO_ROOT, 'packages/shared-types/dist/index.js');
  let shared;
  let zod;
  try {
    shared = require(sharedTypesDist);
    zod = require(require.resolve('zod', { paths: [join(REPO_ROOT, 'packages/shared-types')] }));
  } catch (error) {
    process.stderr.write(
      `✖ shared-types 를 읽을 수 없습니다. 먼저 빌드하세요: pnpm --filter @repo/shared-types build\n  ${String(error)}\n`,
    );
    process.exit(1);
  }

  const contracts = shared.DART_MIRRORED_CONTRACTS;
  if (!contracts) {
    process.stderr.write('✖ DART_MIRRORED_CONTRACTS 를 찾을 수 없습니다.\n');
    process.exit(1);
  }

  const problems = [];
  const sources = new Map();
  let checked = 0;

  for (const mirror of MIRRORS) {
    const schema = contracts[mirror.contract];
    if (!schema) {
      problems.push(
        `${mirror.contract}: DART_MIRRORED_CONTRACTS 에 없습니다 (목록과 매핑이 어긋남)`,
      );
      continue;
    }
    if (mirror.skip) {
      process.stdout.write(`  - ${mirror.contract}: 건너뜀 (${mirror.skip})\n`);
      continue;
    }

    const jsonSchema = zod.toJSONSchema(schema, { io: 'output' });
    const contractFields = propertiesAt(jsonSchema, mirror.path);
    if (contractFields.size === 0) {
      problems.push(
        `${mirror.contract}: JSON Schema 에 속성이 없습니다 (스키마가 객체가 아닐 수 있음)`,
      );
      continue;
    }

    if (!sources.has(mirror.file)) {
      sources.set(mirror.file, await readFile(join(REPO_ROOT, mirror.file), 'utf8'));
    }
    const source = sources.get(mirror.file);
    const body = mirror.keysFrom
      ? extractFunctionBody(source, mirror.keysFrom)
      : extractClassBody(source, mirror.class);
    if (body === undefined) {
      const target = mirror.keysFrom ? `함수 ${mirror.keysFrom}` : `클래스 ${mirror.class}`;
      problems.push(`${mirror.contract}: Dart ${target} 를 ${mirror.file} 에서 찾지 못했습니다`);
      continue;
    }

    const dartKeys = extractJsonKeys(body);
    const missing = [...contractFields].filter((field) => !dartKeys.has(field));
    // Dart 가 계약에 없는 키를 읽으면, 서버가 더 이상 보내지 않는 필드를 기대하고 있다는 뜻이다
    const unknown = [...dartKeys].filter((key) => !contractFields.has(key));

    if (missing.length > 0) {
      problems.push(
        `${mirror.contract} → ${mirror.class}: Dart 가 읽지 않는 계약 필드 [${missing.join(', ')}]\n` +
          `    ${mirror.file}`,
      );
    }
    if (unknown.length > 0) {
      problems.push(
        `${mirror.contract} → ${mirror.class}: 계약에 없는 키를 Dart 가 읽음 [${unknown.join(', ')}]\n` +
          `    ${mirror.file}`,
      );
    }
    if (missing.length === 0 && unknown.length === 0) {
      const label = mirror.path ? `${mirror.contract}.${mirror.path.join('.')}` : mirror.contract;
      process.stdout.write(`  ✓ ${label} → ${mirror.class} (${contractFields.size}개 필드)\n`);
    }
    checked += 1;
  }

  // 목록에는 있는데 매핑이 없는 계약 = Dart 사본을 만들고 등록을 잊은 경우
  const mapped = new Set(MIRRORS.map((m) => m.contract));
  for (const name of Object.keys(contracts)) {
    if (!mapped.has(name)) {
      problems.push(
        `${name}: DART_MIRRORED_CONTRACTS 에 있지만 이 스크립트의 MIRRORS 매핑에 없습니다`,
      );
    }
  }

  if (problems.length > 0) {
    process.stderr.write(`\n✖ 계약과 Dart 모델이 어긋났습니다 (${problems.length}건)\n\n`);
    for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
    process.stderr.write(
      '\n  Zod 스키마를 바꿀 때는 같은 커밋에서 Dart 모델도 고칩니다 (루트 CLAUDE.md "API 계약").\n',
    );
    process.exit(1);
  }

  process.stdout.write(`\n✔ Dart 사본 ${checked}개가 계약과 일치합니다\n`);
}

await main();
