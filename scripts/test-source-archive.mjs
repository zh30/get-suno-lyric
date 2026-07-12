import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = path.join(repoRoot, 'scripts/source-archive.js');
const APPROVED_TAG = 'v2.0.9';
const APPROVED_TAG_REF = 'refs/tags/v2.0.9';
const APPROVED_COMMIT = '98813c64624c4b98c7c80cdd63dd337e2198e8d9';
const APPROVED_ARCHIVE_FILENAME = 'get-suno-lyric-2.0.9-source.zip';
const APPROVED_ARCHIVE_PREFIX = 'get-suno-lyric-2.0.9';
const APPROVED_MANIFEST_FILENAME = 'source-archive-manifest.json';
const APPROVED_ARCHIVE_URL =
  'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip';
const APPROVED_CHECKSUM_URL = `${APPROVED_ARCHIVE_URL}.sha256`;
const APPROVED_ARCHIVE_SHA256 =
  '055c7d066cf3a5b6de8389ce753af7547999fc319212cee76dde1eed921c3eb5';

function loadSourceArchive() {
  assert.equal(fs.existsSync(modulePath), true, 'scripts/source-archive.js must exist');
  return require(modulePath);
}

function git(repo, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: repo,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function makeTempDir(t, prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return tempDir;
}

function listCommitFiles(repo, commit) {
  return git(repo, ['ls-tree', '-r', '--name-only', commit])
    .trim()
    .split('\n')
    .filter(Boolean);
}

function readCommitFile(repo, commit, filePath) {
  return git(repo, ['show', `${commit}:${filePath}`], null);
}

function listArchiveEntries(archivePath) {
  return execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

function readArchiveEntry(archivePath, entryName) {
  return execFileSync('unzip', ['-p', archivePath, entryName], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parseCentralDirectory(archivePath) {
  const bytes = fs.readFileSync(archivePath);
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = bytes.lastIndexOf(endSignature);
  assert.notEqual(endOffset, -1, 'ZIP end-of-central-directory record must exist');

  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let offset = bytes.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, 'central directory entry expected');
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const nameStart = offset + 46;
    entries.push({
      name: bytes.subarray(nameStart, nameStart + nameLength).toString('utf8'),
      compressionMethod: bytes.readUInt16LE(offset + 10),
      dosTime: bytes.readUInt16LE(offset + 12),
      dosDate: bytes.readUInt16LE(offset + 14),
      mode: (externalAttributes >>> 16) & 0o777,
    });
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

function makeRetargetableHistoricalRepo(t, expectedTagRef, expectedCommit) {
  const tempRepo = makeTempDir(t, 'suno-source-retarget-');
  git(tempRepo, ['init', '--quiet']);
  git(tempRepo, ['config', 'user.name', 'Source Archive Test']);
  git(tempRepo, ['config', 'user.email', 'source-archive@example.test']);
  git(tempRepo, ['fetch', '--quiet', repoRoot, `${expectedTagRef}:${expectedTagRef}`]);
  git(tempRepo, ['checkout', '--quiet', '-b', 'divergent', expectedCommit]);
  fs.writeFileSync(path.join(tempRepo, 'post-validation.txt'), 'must not be archived\n');
  fs.appendFileSync(path.join(tempRepo, 'README.md'), '\nmust not replace approved bytes\n');
  git(tempRepo, ['add', 'post-validation.txt', 'README.md']);
  git(tempRepo, ['commit', '--quiet', '-m', 'divergent tag target']);
  const divergentCommit = git(tempRepo, ['rev-parse', 'HEAD']).trim();
  git(tempRepo, ['checkout', '--quiet', '--detach', expectedCommit]);
  return { divergentCommit, tempRepo };
}

test('locks the fully qualified historical tag to the approved commit', () => {
  const {
    EXPECTED_TAG,
    EXPECTED_TAG_REF,
    EXPECTED_TAG_SHA,
    assertExpectedTag,
  } = loadSourceArchive();
  assert.equal(EXPECTED_TAG, 'v2.0.9');
  assert.equal(EXPECTED_TAG_REF, 'refs/tags/v2.0.9');
  assert.equal(EXPECTED_TAG_SHA, '98813c64624c4b98c7c80cdd63dd337e2198e8d9');
  assert.equal(assertExpectedTag(repoRoot), EXPECTED_TAG_SHA);
  assert.throws(
    () => assertExpectedTag(repoRoot, '0'.repeat(40)),
    /does not match the approved historical commit/,
  );
});

test('exports the canonical archive names and public URLs', () => {
  const {
    ARCHIVE_FILENAME,
    ARCHIVE_MANIFEST_FILENAME,
    ARCHIVE_PREFIX,
    SOURCE_ARCHIVE_CHECKSUM_URL,
    SOURCE_ARCHIVE_MANIFEST_URL,
    SOURCE_ARCHIVE_URL,
    SOURCE_CUTOFF_URL,
  } = loadSourceArchive();
  assert.equal(ARCHIVE_FILENAME, 'get-suno-lyric-2.0.9-source.zip');
  assert.equal(ARCHIVE_MANIFEST_FILENAME, 'source-archive-manifest.json');
  assert.equal(ARCHIVE_PREFIX, 'get-suno-lyric-2.0.9');
  assert.equal(
    SOURCE_ARCHIVE_URL,
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip',
  );
  assert.equal(
    SOURCE_ARCHIVE_CHECKSUM_URL,
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256',
  );
  assert.equal(
    SOURCE_ARCHIVE_MANIFEST_URL,
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/source-archive-manifest.json',
  );
  assert.equal(
    SOURCE_CUTOFF_URL,
    'https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json',
  );
});

test('describes added archive metadata without rewriting the tag', () => {
  const { buildProvenance } = loadSourceArchive();
  const text = buildProvenance();
  assert.match(text, /v2\.0\.9/);
  assert.match(text, /98813c64624c4b98c7c80cdd63dd337e2198e8d9/);
  assert.match(text, /added to this archive outside the tagged Git tree/);
  assert.match(text, /does not move or rewrite the tag/);
});

test('keeps archive reads pinned when the validated tag moves', async (t) => {
  const {
    createSourceArchive,
  } = loadSourceArchive();
  const { divergentCommit, tempRepo } = makeRetargetableHistoricalRepo(
    t,
    APPROVED_TAG_REF,
    APPROVED_COMMIT,
  );
  const outputDir = path.join(makeTempDir(t, 'suno-source-race-output-'), 'archive');
  const expectedEntries = [
    ...listCommitFiles(tempRepo, APPROVED_COMMIT).map(
      (filePath) => `${APPROVED_ARCHIVE_PREFIX}/${filePath}`,
    ),
    `${APPROVED_ARCHIVE_PREFIX}/LICENSE-MIT.txt`,
    `${APPROVED_ARCHIVE_PREFIX}/SOURCE_PROVENANCE.txt`,
  ];

  const pendingArchive = createSourceArchive({ repoRoot: tempRepo, outputDir });
  git(tempRepo, ['update-ref', APPROVED_TAG_REF, divergentCommit]);
  const result = await pendingArchive;

  assert.deepEqual(
    listArchiveEntries(result.archivePath),
    expectedEntries,
    'archive content must stay pinned to the commit returned by tag validation',
  );
  for (const filePath of listCommitFiles(tempRepo, APPROVED_COMMIT)) {
    assert.deepEqual(
      readArchiveEntry(result.archivePath, `${APPROVED_ARCHIVE_PREFIX}/${filePath}`),
      readCommitFile(tempRepo, APPROVED_COMMIT, filePath),
      `retargeted tag must not replace approved bytes for ${filePath}`,
    );
  }
});

test('creates a complete byte-stable stored archive and exact metadata', async (t) => {
  const {
    buildProvenance,
    createSourceArchive,
    sha256File,
  } = loadSourceArchive();
  const tempRoot = makeTempDir(t, 'suno-source-archive-');
  const first = await createSourceArchive({ repoRoot, outputDir: path.join(tempRoot, 'first') });
  const second = await createSourceArchive({ repoRoot, outputDir: path.join(tempRoot, 'second') });

  assert.equal(path.basename(first.archivePath), APPROVED_ARCHIVE_FILENAME);
  assert.equal(path.basename(first.manifestPath), APPROVED_MANIFEST_FILENAME);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.sha256, sha256File(first.archivePath));
  assert.equal(first.sha256, APPROVED_ARCHIVE_SHA256);
  assert.match(first.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    fs.readFileSync(first.checksumPath, 'utf8'),
    `${first.sha256}  ${APPROVED_ARCHIVE_FILENAME}\n`,
  );

  const treeFiles = listCommitFiles(repoRoot, APPROVED_COMMIT);
  const expectedEntries = [
    ...treeFiles.map((filePath) => `${APPROVED_ARCHIVE_PREFIX}/${filePath}`),
    `${APPROVED_ARCHIVE_PREFIX}/LICENSE-MIT.txt`,
    `${APPROVED_ARCHIVE_PREFIX}/SOURCE_PROVENANCE.txt`,
  ];
  assert.deepEqual(listArchiveEntries(first.archivePath), expectedEntries);

  for (const filePath of treeFiles) {
    assert.deepEqual(
      readArchiveEntry(first.archivePath, `${APPROVED_ARCHIVE_PREFIX}/${filePath}`),
      readCommitFile(repoRoot, APPROVED_COMMIT, filePath),
      `archived bytes must match ${APPROVED_COMMIT}:${filePath}`,
    );
  }
  assert.deepEqual(
    readArchiveEntry(first.archivePath, `${APPROVED_ARCHIVE_PREFIX}/LICENSE-MIT.txt`),
    fs.readFileSync(path.join(repoRoot, 'scripts/assets/MIT-LICENSE-2.0.9.txt')),
  );
  assert.deepEqual(
    readArchiveEntry(first.archivePath, `${APPROVED_ARCHIVE_PREFIX}/SOURCE_PROVENANCE.txt`),
    Buffer.from(buildProvenance()),
  );

  const centralEntries = parseCentralDirectory(first.archivePath);
  assert.deepEqual(
    centralEntries.map(({ name }) => name),
    expectedEntries,
  );
  for (const entry of centralEntries) {
    assert.equal(entry.compressionMethod, 0, `${entry.name} must use ZIP STORE mode`);
    assert.equal(entry.dosTime, 0, `${entry.name} must have the fixed midnight time`);
    assert.equal(entry.dosDate, 0x2821, `${entry.name} must have the fixed 2000-01-01 date`);
    assert.equal(entry.mode, 0o644, `${entry.name} must have mode 0644`);
  }

  const manifest = JSON.parse(fs.readFileSync(first.manifestPath, 'utf8'));
  assert.deepEqual(manifest, {
    product: 'Suno Lyric Downloader',
    tag: APPROVED_TAG,
    commit: APPROVED_COMMIT,
    archiveFilename: APPROVED_ARCHIVE_FILENAME,
    sha256: first.sha256,
    archiveUrl: APPROVED_ARCHIVE_URL,
    checksumUrl: APPROVED_CHECKSUM_URL,
  });
});
