const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXPECTED_TAG = 'v2.0.9';
const EXPECTED_TAG_REF = `refs/tags/${EXPECTED_TAG}`;
const EXPECTED_TAG_SHA = '98813c64624c4b98c7c80cdd63dd337e2198e8d9';
const ARCHIVE_FILENAME = 'get-suno-lyric-2.0.9-source.zip';
const ARCHIVE_PREFIX = 'get-suno-lyric-2.0.9';
const ARCHIVE_MANIFEST_FILENAME = 'source-archive-manifest.json';
const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00Z');
const PUBLIC_BASE_URL = 'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9';
const SOURCE_ARCHIVE_URL = `${PUBLIC_BASE_URL}/${ARCHIVE_FILENAME}`;
const SOURCE_ARCHIVE_CHECKSUM_URL = `${SOURCE_ARCHIVE_URL}.sha256`;
const SOURCE_ARCHIVE_MANIFEST_URL = `${PUBLIC_BASE_URL}/${ARCHIVE_MANIFEST_FILENAME}`;
const SOURCE_CUTOFF_URL = 'https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json';

function git(repoRoot, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function assertExpectedTag(repoRoot, expectedSha = EXPECTED_TAG_SHA) {
  let actualSha;
  try {
    actualSha = git(repoRoot, [
      'rev-parse',
      '--verify',
      '--quiet',
      `${EXPECTED_TAG_REF}^{commit}`,
    ]).trim();
  } catch {
    throw new Error(`historical tag ${EXPECTED_TAG_REF} is missing`);
  }
  if (actualSha !== expectedSha) {
    throw new Error(
      `${EXPECTED_TAG} resolves to ${actualSha}, which does not match the approved historical commit ${expectedSha}`,
    );
  }
  return actualSha;
}

function listCommitFiles(repoRoot, commit) {
  return git(repoRoot, ['ls-tree', '-r', '--name-only', commit])
    .split('\n')
    .filter(Boolean);
}

function readCommitFile(repoRoot, commit, filePath) {
  return git(repoRoot, ['show', `${commit}:${filePath}`], null);
}

function buildProvenance() {
  return [
    'Suno Lyric Downloader historical source archive',
    '',
    `Git tag: ${EXPECTED_TAG}`,
    `Git commit: ${EXPECTED_TAG_SHA}`,
    '',
    'Every project file in this archive was read from the immutable tagged Git tree above.',
    'LICENSE-MIT.txt and SOURCE_PROVENANCE.txt were added to this archive outside the tagged Git tree.',
    'Adding those archival metadata files does not move or rewrite the tag.',
    'The main repository may later become private; that does not revoke permissions already received for historical source.',
    '',
  ].join('\n');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function createSourceArchive({
  repoRoot = path.resolve(__dirname, '..'),
  outputDir = path.resolve(__dirname, '../release-artifacts/get-suno-lyric/v2.0.9'),
} = {}) {
  const commit = assertExpectedTag(repoRoot);
  fs.mkdirSync(outputDir, { recursive: true });

  const archivePath = path.join(outputDir, ARCHIVE_FILENAME);
  const checksumPath = `${archivePath}.sha256`;
  const manifestPath = path.join(outputDir, ARCHIVE_MANIFEST_FILENAME);
  const licensePath = path.join(__dirname, 'assets/MIT-LICENSE-2.0.9.txt');
  const output = fs.createWriteStream(archivePath);
  const { ZipArchive } = await import('archiver');
  const archive = new ZipArchive({ store: true });
  const closed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);
  for (const filePath of listCommitFiles(repoRoot, commit)) {
    archive.append(readCommitFile(repoRoot, commit, filePath), {
      name: `${ARCHIVE_PREFIX}/${filePath}`,
      date: ZIP_ENTRY_DATE,
      mode: 0o644,
    });
  }
  archive.append(fs.readFileSync(licensePath), {
    name: `${ARCHIVE_PREFIX}/LICENSE-MIT.txt`,
    date: ZIP_ENTRY_DATE,
    mode: 0o644,
  });
  archive.append(buildProvenance(), {
    name: `${ARCHIVE_PREFIX}/SOURCE_PROVENANCE.txt`,
    date: ZIP_ENTRY_DATE,
    mode: 0o644,
  });

  await archive.finalize();
  await closed;

  const sha256 = sha256File(archivePath);
  fs.writeFileSync(checksumPath, `${sha256}  ${ARCHIVE_FILENAME}\n`);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({
      product: 'Suno Lyric Downloader',
      tag: EXPECTED_TAG,
      commit,
      archiveFilename: ARCHIVE_FILENAME,
      sha256,
      archiveUrl: SOURCE_ARCHIVE_URL,
      checksumUrl: SOURCE_ARCHIVE_CHECKSUM_URL,
    }, null, 2)}\n`,
  );

  return { archivePath, checksumPath, manifestPath, sha256 };
}

module.exports = {
  ARCHIVE_FILENAME,
  ARCHIVE_MANIFEST_FILENAME,
  ARCHIVE_PREFIX,
  EXPECTED_TAG,
  EXPECTED_TAG_REF,
  EXPECTED_TAG_SHA,
  SOURCE_ARCHIVE_CHECKSUM_URL,
  SOURCE_ARCHIVE_MANIFEST_URL,
  SOURCE_ARCHIVE_URL,
  SOURCE_CUTOFF_URL,
  assertExpectedTag,
  buildProvenance,
  createSourceArchive,
  sha256File,
};
