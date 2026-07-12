import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'write-source-cutoff-record.js',
);

function loadCutoffModule() {
  assert.equal(
    fs.existsSync(modulePath),
    true,
    'scripts/write-source-cutoff-record.js must exist',
  );
  return require(modulePath);
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function makeRepo({ annotated = true } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suno-cutoff-test-'));
  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.name', 'Source Transition Test']);
  git(repoRoot, ['config', 'user.email', 'source-transition@example.test']);
  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'public source\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'test public source']);
  const tagArgs = annotated
    ? ['tag', '-a', 'oss-source-cutoff', '-m', 'test cutoff']
    : ['tag', 'oss-source-cutoff'];
  git(repoRoot, tagArgs);
  return repoRoot;
}

test('reads an annotated cutoff and renders the exact historical notice', () => {
  const {
    readCutoff,
    renderHistoricalSourceNotice,
    writeCutoffRecord,
  } = loadCutoffModule();
  const repoRoot = makeRepo();
  const record = readCutoff(repoRoot);
  const expectedCommit = git(repoRoot, ['rev-parse', 'oss-source-cutoff^{commit}']);
  const expectedDate = git(repoRoot, [
    'for-each-ref',
    '--format=%(taggerdate:iso-strict)',
    'refs/tags/oss-source-cutoff',
  ]);
  assert.equal(record.commit, expectedCommit);
  assert.equal(record.taggedAt, expectedDate);

  const notice = renderHistoricalSourceNotice(record);
  assert.ok(notice.includes(expectedCommit));
  assert.ok(notice.includes('98813c64624c4b98c7c80cdd63dd337e2198e8d9'));
  assert.match(notice, /does not revoke/i);

  const outputPath = path.join(os.tmpdir(), `${expectedCommit}-cutoff.json`);
  const written = writeCutoffRecord({ repoRoot, outputPath });
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), written);
});

test('rejects a lightweight cutoff tag', () => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(() => readCutoff(makeRepo({ annotated: false })), /must be an annotated tag/);
});

test('rejects a dirty working tree', () => {
  const { readCutoff } = loadCutoffModule();
  const repoRoot = makeRepo();
  fs.writeFileSync(path.join(repoRoot, 'uncommitted.txt'), 'dirty\n');
  assert.throws(() => readCutoff(repoRoot), /working tree must be clean/);
});

test('refuses to replace a record for another commit', () => {
  const { writeCutoffRecord } = loadCutoffModule();
  const repoRoot = makeRepo();
  const outputPath = path.join(os.tmpdir(), `${path.basename(repoRoot)}-cutoff.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ commit: '0'.repeat(40) })}\n`);
  assert.throws(
    () => writeCutoffRecord({ repoRoot, outputPath }),
    /existing cutoff record points to a different commit/,
  );
});
