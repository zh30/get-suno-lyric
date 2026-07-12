const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CUTOFF_TAG = 'oss-source-cutoff';

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function readCutoff(repoRoot, { requireClean = true } = {}) {
  if (git(repoRoot, ['cat-file', '-t', `refs/tags/${CUTOFF_TAG}`]) !== 'tag') {
    throw new Error(`${CUTOFF_TAG} must be an annotated tag`);
  }
  if (requireClean && git(repoRoot, ['status', '--porcelain'])) {
    throw new Error('working tree must be clean before recording the cutoff');
  }
  return {
    tag: CUTOFF_TAG,
    commit: git(repoRoot, ['rev-parse', `${CUTOFF_TAG}^{commit}`]),
    taggedAt: git(repoRoot, [
      'for-each-ref',
      '--format=%(taggerdate:iso-strict)',
      `refs/tags/${CUTOFF_TAG}`,
    ]),
    historicalRelease: {
      tag: 'v2.0.9',
      commit: '98813c64624c4b98c7c80cdd63dd337e2198e8d9',
    },
    sourceArchive: 'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip',
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
  return `# Historical Source Notice

Suno Lyric Downloader 2.0.9 is the final open-source product release.

- Historical release tag: \`v2.0.9\`
- Historical release commit: \`98813c64624c4b98c7c80cdd63dd337e2198e8d9\`
- Final public-source tag: \`${record.tag}\`
- Final public-source cutoff: \`${record.commit}\`
- Historical source archive: <https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip>
- Archive checksum: <https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256>
- Public cutoff record: <https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json>

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
  readCutoff,
  renderHistoricalSourceNotice,
  writeCutoffRecord,
};
