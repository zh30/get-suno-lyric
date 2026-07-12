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

function loadSourceArchive() {
  assert.equal(fs.existsSync(modulePath), true, 'scripts/source-archive.js must exist');
  return require(modulePath);
}

test('locks the historical source to the approved v2.0.9 commit', () => {
  const {
    EXPECTED_TAG,
    EXPECTED_TAG_SHA,
    assertExpectedTag,
  } = loadSourceArchive();
  assert.equal(EXPECTED_TAG, 'v2.0.9');
  assert.equal(EXPECTED_TAG_SHA, '98813c64624c4b98c7c80cdd63dd337e2198e8d9');
  assert.equal(assertExpectedTag(repoRoot), EXPECTED_TAG_SHA);
  assert.throws(
    () => assertExpectedTag(repoRoot, '0'.repeat(40)),
    /does not match the approved historical commit/,
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

test('creates byte-stable archives with source, license, provenance, and checksum', async () => {
  const {
    ARCHIVE_FILENAME,
    EXPECTED_TAG,
    EXPECTED_TAG_SHA,
    createSourceArchive,
    sha256File,
  } = loadSourceArchive();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suno-source-archive-'));
  const first = await createSourceArchive({ repoRoot, outputDir: path.join(tempRoot, 'first') });
  const second = await createSourceArchive({ repoRoot, outputDir: path.join(tempRoot, 'second') });

  assert.equal(path.basename(first.archivePath), ARCHIVE_FILENAME);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.sha256, sha256File(first.archivePath));
  assert.equal(
    fs.readFileSync(first.checksumPath, 'utf8'),
    `${first.sha256}  ${ARCHIVE_FILENAME}\n`,
  );

  const entries = execFileSync('unzip', ['-Z1', first.archivePath], { encoding: 'utf8' })
    .trim()
    .split('\n');
  assert.ok(entries.includes('get-suno-lyric-2.0.9/package.json'));
  assert.ok(entries.includes('get-suno-lyric-2.0.9/LICENSE-MIT.txt'));
  assert.ok(entries.includes('get-suno-lyric-2.0.9/SOURCE_PROVENANCE.txt'));
  assert.ok(!entries.some((entry) => entry.includes('/.git/')));

  const manifest = JSON.parse(fs.readFileSync(first.manifestPath, 'utf8'));
  assert.equal(manifest.tag, EXPECTED_TAG);
  assert.equal(manifest.commit, EXPECTED_TAG_SHA);
  assert.equal(manifest.sha256, first.sha256);
  assert.equal(
    manifest.archiveUrl,
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip',
  );
});
