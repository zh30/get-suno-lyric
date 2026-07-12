import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const modulePath = path.join(scriptsDir, 'write-source-cutoff-record.js');
const sourceArchiveModulePath = path.join(scriptsDir, 'source-archive.js');
const APPROVED_TAG = 'v2.0.9';
const APPROVED_TAG_REF = 'refs/tags/v2.0.9';
const APPROVED_COMMIT = '98813c64624c4b98c7c80cdd63dd337e2198e8d9';
const APPROVED_ARCHIVE_URL =
  'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip';
const APPROVED_CHECKSUM_URL = `${APPROVED_ARCHIVE_URL}.sha256`;
const APPROVED_CUTOFF_URL =
  'https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json';

function loadCutoffModule() {
  assert.equal(
    fs.existsSync(modulePath),
    true,
    'scripts/write-source-cutoff-record.js must exist',
  );
  return require(modulePath);
}

function loadSourceArchiveModule() {
  assert.equal(
    fs.existsSync(sourceArchiveModulePath),
    true,
    'scripts/source-archive.js must exist',
  );
  return require(sourceArchiveModulePath);
}

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function makeTempDir(t, prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return tempDir;
}

function makeRepo(t, { cutoffTag = 'annotated', historicalTag = 'valid' } = {}) {
  const tempRoot = makeTempDir(t, 'suno-cutoff-test-');
  const tempRepo = path.join(tempRoot, 'repo');
  fs.mkdirSync(tempRepo);
  git(tempRepo, ['init', '--quiet']);
  git(tempRepo, ['config', 'user.name', 'Source Transition Test']);
  git(tempRepo, ['config', 'user.email', 'source-transition@example.test']);
  git(tempRepo, ['fetch', '--quiet', repoRoot, `${APPROVED_TAG_REF}:${APPROVED_TAG_REF}`]);
  git(tempRepo, ['checkout', '--quiet', '-b', 'cutoff-work', APPROVED_COMMIT]);
  fs.writeFileSync(path.join(tempRepo, 'cutoff.txt'), 'final public source\n');
  git(tempRepo, ['add', 'cutoff.txt']);
  git(tempRepo, ['commit', '--quiet', '-m', 'test public cutoff']);

  if (historicalTag === 'missing') {
    git(tempRepo, ['update-ref', '-d', APPROVED_TAG_REF]);
  } else if (historicalTag === 'mismatched') {
    git(tempRepo, ['update-ref', APPROVED_TAG_REF, 'HEAD']);
  }

  if (cutoffTag === 'annotated') {
    git(tempRepo, ['tag', '-a', 'oss-source-cutoff', '-m', 'test cutoff']);
  } else if (cutoffTag === 'lightweight') {
    git(tempRepo, ['tag', 'oss-source-cutoff']);
  }

  return tempRepo;
}

test('reads an annotated cutoff and emits the complete canonical record', (t) => {
  const {
    readCutoff,
    renderHistoricalSourceNotice,
    writeCutoffRecord,
  } = loadCutoffModule();
  loadSourceArchiveModule();
  const tempRepo = makeRepo(t);
  const expectedCommit = git(tempRepo, [
    'rev-parse',
    '--verify',
    'refs/tags/oss-source-cutoff^{commit}',
  ]);
  const expectedDate = git(tempRepo, [
    'for-each-ref',
    '--format=%(taggerdate:iso-strict)',
    'refs/tags/oss-source-cutoff',
  ]);
  const expectedRecord = {
    tag: 'oss-source-cutoff',
    commit: expectedCommit,
    taggedAt: expectedDate,
    historicalRelease: {
      tag: APPROVED_TAG,
      commit: APPROVED_COMMIT,
    },
    sourceArchive: APPROVED_ARCHIVE_URL,
  };

  const record = readCutoff(tempRepo);
  assert.deepEqual(record, expectedRecord);

  const notice = renderHistoricalSourceNotice(record);
  for (const expectedText of [
    APPROVED_TAG,
    APPROVED_COMMIT,
    expectedCommit,
    APPROVED_ARCHIVE_URL,
    APPROVED_CHECKSUM_URL,
    APPROVED_CUTOFF_URL,
  ]) {
    assert.ok(notice.includes(expectedText), `historical notice missing: ${expectedText}`);
  }
  assert.match(notice, /does not revoke/i);

  const artifactRoot = makeTempDir(t, 'suno-cutoff-artifact-');
  const outputPath = path.join(artifactRoot, 'oss-source-cutoff.json');
  const written = writeCutoffRecord({ repoRoot: tempRepo, outputPath });
  assert.deepEqual(written, expectedRecord);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), expectedRecord);
});

test('renders historical release and archive values from the cutoff record', () => {
  const { renderHistoricalSourceNotice } = loadCutoffModule();
  const fixtureRecord = {
    tag: 'fixture-cutoff',
    commit: 'c'.repeat(40),
    taggedAt: '2026-07-13T00:00:00+08:00',
    historicalRelease: {
      tag: 'v-fixture',
      commit: 'a'.repeat(40),
    },
    sourceArchive: 'https://example.test/source.zip',
  };
  const notice = renderHistoricalSourceNotice(fixtureRecord);
  assert.match(notice, /Historical release tag: `v-fixture`/);
  assert.ok(notice.includes(`Historical release commit: \`${'a'.repeat(40)}\``));
  assert.match(notice, /Historical source archive: <https:\/\/example\.test\/source\.zip>/);
});

test('rejects a missing cutoff tag with a concise domain error', (t) => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(
    () => readCutoff(makeRepo(t, { cutoffTag: 'missing' })),
    (error) => error instanceof Error && error.message === 'oss-source-cutoff tag is missing',
  );
});

test('rejects a lightweight cutoff tag with a concise domain error', (t) => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(
    () => readCutoff(makeRepo(t, { cutoffTag: 'lightweight' })),
    (error) => error instanceof Error && error.message === 'oss-source-cutoff must be an annotated tag',
  );
});

test('rejects a missing historical release tag', (t) => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(
    () => readCutoff(makeRepo(t, { historicalTag: 'missing' })),
    /historical tag refs\/tags\/v2\.0\.9 is missing/,
  );
});

test('rejects a historical release tag at an unapproved commit', (t) => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(
    () => readCutoff(makeRepo(t, { historicalTag: 'mismatched' })),
    /does not match the approved historical commit/,
  );
});

test('rejects a dirty working tree', (t) => {
  const { readCutoff } = loadCutoffModule();
  const tempRepo = makeRepo(t);
  fs.writeFileSync(path.join(tempRepo, 'uncommitted.txt'), 'dirty\n');
  assert.throws(() => readCutoff(tempRepo), /working tree must be clean/);
});

test('refuses to replace a record for another commit', (t) => {
  const { writeCutoffRecord } = loadCutoffModule();
  const tempRepo = makeRepo(t);
  const artifactRoot = makeTempDir(t, 'suno-cutoff-conflict-');
  const outputPath = path.join(artifactRoot, 'oss-source-cutoff.json');
  fs.writeFileSync(outputPath, `${JSON.stringify({ commit: '0'.repeat(40) })}\n`);
  assert.throws(
    () => writeCutoffRecord({ repoRoot: tempRepo, outputPath }),
    /existing cutoff record points to a different commit/,
  );
});
