import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => {
  const filePath = path.join(repoRoot, file);
  assert.equal(fs.existsSync(filePath), true, `${file} must exist`);
  return fs.readFileSync(filePath, 'utf8');
};

test('transition announcement preserves the approved trust promises', () => {
  const announcement = read('SOURCE_TRANSITION.md');
  for (const requiredText of [
    '2.0.9 is the final open-source product release',
    '3.0.0 and later are proprietary',
    'LRC download, SRT download, and automatic timing repair remain free',
    'optional one-time purchase',
    'same Chrome Web Store extension',
    'Song data, lyrics, audio, projects, and videos remain local',
    'at least 14 full calendar days',
    '98813c64624c4b98c7c80cdd63dd337e2198e8d9',
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip',
    'https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json',
  ]) {
    assert.ok(announcement.includes(requiredText), `missing: ${requiredText}`);
  }
  assert.doesNotMatch(announcement, /T[B]D|T[O]DO|coming soon|never open source/i);
});

test('readme links the durable transition notice and avoids retroactive claims', () => {
  const readme = read('README.md');
  assert.match(readme, /SOURCE_TRANSITION\.md/);
  assert.doesNotMatch(readme, /historical forks are unauthorized/i);
});
