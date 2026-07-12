const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  EXPECTED_TAG,
  SOURCE_ARCHIVE_CHECKSUM_URL,
  SOURCE_ARCHIVE_URL,
  SOURCE_CUTOFF_URL,
  assertExpectedTag,
} = require('./source-archive.js');

const CUTOFF_TAG = 'oss-source-cutoff';
const CUTOFF_TAG_REF = `refs/tags/${CUTOFF_TAG}`;

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function readCutoffTagType(repoRoot) {
  const result = spawnSync('git', ['cat-file', '-t', CUTOFF_TAG_REF], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${CUTOFF_TAG} tag is missing`);
  }
  return result.stdout.trim();
}

function readCutoff(repoRoot, { requireClean = true } = {}) {
  if (readCutoffTagType(repoRoot) !== 'tag') {
    throw new Error(`${CUTOFF_TAG} must be an annotated tag`);
  }
  if (requireClean && git(repoRoot, ['status', '--porcelain'])) {
    throw new Error('working tree must be clean before recording the cutoff');
  }
  const historicalCommit = assertExpectedTag(repoRoot);
  return {
    tag: CUTOFF_TAG,
    commit: git(repoRoot, ['rev-parse', '--verify', `${CUTOFF_TAG_REF}^{commit}`]),
    taggedAt: git(repoRoot, [
      'for-each-ref',
      '--format=%(taggerdate:iso-strict)',
      CUTOFF_TAG_REF,
    ]),
    historicalRelease: {
      tag: EXPECTED_TAG,
      commit: historicalCommit,
    },
    sourceArchive: SOURCE_ARCHIVE_URL,
  };
}

function writeCutoffRecord({ repoRoot, outputPath }) {
  const record = readCutoff(repoRoot);
  if (fs.existsSync(outputPath)) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (existing.commit !== record.commit) {
      throw new Error('existing cutoff record points to a different commit');
    }
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function renderHistoricalSourceNotice(record) {
  const historicalVersion = record.historicalRelease.tag.replace(/^v/, '');
  return `# Historical Source Notice

Suno Lyric Downloader ${historicalVersion} is the final open-source product release.

- Historical release tag: \`${record.historicalRelease.tag}\`
- Historical release commit: \`${record.historicalRelease.commit}\`
- Final public-source tag: \`${record.tag}\`
- Final public-source cutoff: \`${record.commit}\`
- Historical source archive: <${record.sourceArchive}>
- Archive checksum: <${SOURCE_ARCHIVE_CHECKSUM_URL}>
- Public cutoff record: <${SOURCE_CUTOFF_URL}>

Extension version 3.0.0 and later are distributed under the proprietary terms in \`LICENSE\`.
This change does not revoke, delete, or retroactively alter permissions already received for historical public source, copies, or forks.
Third-party software remains governed by its own license terms.
`;
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..');
  const outputPath = path.resolve(
    __dirname,
    '../release-artifacts/get-suno-lyric/oss-source-cutoff.json',
  );
  const record = writeCutoffRecord({ repoRoot, outputPath });
  console.log(`Cutoff: ${record.commit}`);
  console.log(`Record: ${outputPath}`);
}

module.exports = {
  CUTOFF_TAG,
  CUTOFF_TAG_REF,
  readCutoff,
  renderHistoricalSourceNotice,
  writeCutoffRecord,
};
