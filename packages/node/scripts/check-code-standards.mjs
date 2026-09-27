#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const GENERATED = join(SRC, 'generated');

const ALLOWED_COMMENT_PREFIXES = [
  /^\s*eslint-/,
  /^\s*@ts-/,
  /^\s*prettier-ignore/,
  /^\/\s*<reference/,
  /^\s*@vitest-/,
];

const listSourceFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    if (!path.endsWith('.ts')) return [];
    return [path];
  });

const isTsDoc = (text) => text.startsWith('/**');

const isAllowed = (text) => {
  const value = text.startsWith('//') ? text.slice(2) : text.slice(2, -2);
  return ALLOWED_COMMENT_PREFIXES.some((re) => re.test(value));
};

const collectCommentViolations = (source, text) => {
  const found = [];
  const visitTrivia = (pos) => {
    const ranges = [
      ...(ts.getLeadingCommentRanges(text, pos) ?? []),
      ...(ts.getTrailingCommentRanges(text, pos) ?? []),
    ];
    for (const range of ranges) {
      const comment = text.slice(range.pos, range.end);
      if (isAllowed(comment)) continue;
      if (isTsDoc(comment)) continue;
      found.push({ pos: range.pos, message: 'comentário fora de TSDoc' });
    }
  };
  const walk = (node) => {
    visitTrivia(node.getFullStart());
    ts.forEachChild(node, walk);
  };
  walk(source);
  return found;
};

const BANNED_SYNTAX = [
  { kind: ts.SyntaxKind.SwitchStatement, message: 'switch: use tabela de lookup ou early return' },
  { kind: ts.SyntaxKind.VoidExpression, message: 'operador void: trate a promise explicitamente' },
];

const MAX_BLOCK_DEPTH = 3;

const isNestingBlock = (node) =>
  ts.isIfStatement(node) ||
  ts.isForStatement(node) ||
  ts.isForOfStatement(node) ||
  ts.isForInStatement(node) ||
  ts.isWhileStatement(node) ||
  ts.isDoStatement(node);

const collectSyntaxViolations = (source) => {
  const found = [];
  const walk = (node, depth = 0) => {
    for (const banned of BANNED_SYNTAX) {
      if (node.kind === banned.kind) found.push({ pos: node.getStart(source), message: banned.message });
    }
    if (ts.isIfStatement(node) && node.elseStatement) {
      found.push({ pos: node.elseStatement.getStart(source), message: 'else/else if: use early return' });
    }

    const nests = isNestingBlock(node);
    const nextDepth = nests ? depth + 1 : depth;
    if (nests && nextDepth > MAX_BLOCK_DEPTH) {
      found.push({
        pos: node.getStart(source),
        message: `bloco aninhado fundo demais (${nextDepth}); máximo ${MAX_BLOCK_DEPTH}`,
      });
    }
    ts.forEachChild(node, (child) => walk(child, nextDepth));
  };
  walk(source);
  return found;
};

const violations = [];
for (const file of listSourceFiles(SRC)) {
  if (file.startsWith(GENERATED)) continue;
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [...collectCommentViolations(source, text), ...collectSyntaxViolations(source)];
  for (const item of found) {
    const { line, character } = source.getLineAndCharacterOfPosition(item.pos);
    violations.push(`${relative(ROOT, file)}:${line + 1}:${character + 1} ${item.message}`);
  }
}

const unique = [...new Set(violations)].sort();
if (unique.length > 0) {
  console.error(`[check-code-standards] ${unique.length} violações:`);
  for (const line of unique) console.error(`  ${line}`);
  process.exit(1);
}
console.log('[check-code-standards] nenhum desvio de padrão encontrado');
