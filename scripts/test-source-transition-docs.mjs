import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  EXPECTED_TAG,
  EXPECTED_TAG_SHA,
  SOURCE_ARCHIVE_CHECKSUM_URL,
  SOURCE_ARCHIVE_MANIFEST_URL,
  SOURCE_ARCHIVE_URL,
  SOURCE_CUTOFF_URL,
} = require('./source-archive.js');

const read = (file) => {
  const filePath = path.join(repoRoot, file);
  assert.equal(fs.existsSync(filePath), true, `${file} must exist`);
  return fs.readFileSync(filePath, 'utf8');
};

function section(document, startHeading, endHeading) {
  const start = document.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section heading: ${startHeading}`);
  const end = endHeading ? document.indexOf(endHeading, start + startHeading.length) : document.length;
  assert.notEqual(end, -1, `missing section heading: ${endHeading}`);
  return document.slice(start, end);
}

function assertCanonicalSourceLinks(text) {
  for (const requiredText of [
    EXPECTED_TAG,
    EXPECTED_TAG_SHA,
    SOURCE_ARCHIVE_URL,
    SOURCE_ARCHIVE_CHECKSUM_URL,
    SOURCE_ARCHIVE_MANIFEST_URL,
    SOURCE_CUTOFF_URL,
  ]) {
    assert.ok(text.includes(requiredText), `missing canonical source value: ${requiredText}`);
  }
}

test('English announcement preserves current free features and future Creator Pro promises', () => {
  const english = section(read('SOURCE_TRANSITION.md'), '## English', '## 中文');
  for (const requiredText of [
    '2.0.9 is the final open-source product release',
    '3.0.0 and later will be proprietary',
    'LRC download, SRT download, and automatic timing repair remain free',
    'same Chrome Web Store extension',
    'Creator Pro is planned as an optional one-time purchase',
    'When released, it will add creator workflow features without removing or degrading the free 2.0.9 capabilities',
    'When Creator Pro is released, song data, lyrics, audio, projects, and videos will remain local',
    'Only checkout and license validation will use developer-controlled services',
    'at least 14 complete 24-hour periods (1,209,600 seconds)',
    'does not revoke or delete historical copies, forks, or permissions already received',
  ]) {
    assert.ok(english.includes(requiredText), `English announcement missing: ${requiredText}`);
  }
  assertCanonicalSourceLinks(english);
  assert.doesNotMatch(english, /Creator Pro is an optional one-time purchase/);
  assert.doesNotMatch(
    english,
    /Song data, lyrics, audio, projects, and videos remain local\. Only checkout and license validation use/,
  );
  assert.doesNotMatch(english, /14 full calendar days/);
});

test('Chinese announcement independently preserves the same source and product promises', () => {
  const chinese = section(read('SOURCE_TRANSITION.md'), '## 中文');
  for (const requiredText of [
    '2.0.9 是最后一个开源产品版本',
    '3.0.0 及以后版本将采用专有许可',
    'LRC 下载、SRT 下载和现有自动时间轴修复功能继续免费',
    '同一个 Chrome 应用商店插件和原有插件 ID',
    'Creator Pro 计划作为可选的一次性付费功能推出',
    '发布后，它将增加创作者工作流能力，但不会移除或降低 2.0.9 已有免费能力的质量',
    'Creator Pro 发布后，歌曲数据、歌词、音频、项目和视频仍将保留在本地',
    '只有结账和许可证验证会使用开发者控制的服务',
    '至少连续完成 14 个 24 小时周期（共 1,209,600 秒）',
    '不会撤销或删除历史副本、分叉仓库，或用户此前已经获得的许可',
  ]) {
    assert.ok(chinese.includes(requiredText), `Chinese announcement missing: ${requiredText}`);
  }
  assertCanonicalSourceLinks(chinese);
  assert.doesNotMatch(chinese, /Creator Pro 是可选的一次性付费功能/);
  assert.doesNotMatch(chinese, /歌曲数据、歌词、音频、项目和视频都保留在本地/);
  assert.doesNotMatch(chinese, /至少完整 14 个日历日/);
});

test('README preamble carries both source-model notices', () => {
  const preamble = section(read('README.md'), '# Suno Lyric Downloader', '## English User Guide');
  assert.ok(preamble.includes(
    'Version 2.0.9 is the final open-source product release. Existing download features remain free; version 3.0.0 and later will use a proprietary Freemium model.',
  ));
  assert.ok(preamble.includes(
    '2.0.9 是最后一个开源产品版本。现有歌词下载功能继续免费；3.0.0 及以后版本将采用闭源 Freemium 模式。',
  ));
  assert.match(preamble, /\[full transition announcement\]\(SOURCE_TRANSITION\.md\)/);
  assert.match(preamble, /\[完整迁移公告\]\(SOURCE_TRANSITION\.md\)/);
});

test('README support statements keep free features current and Creator Pro planned', () => {
  const readme = read('README.md');
  const english = section(readme, '## English User Guide', '## 中文使用手册');
  const chinese = section(readme, '## 中文使用手册', '## Historical Source License');
  assert.ok(english.includes(
    'The existing LRC, SRT, and automatic timing-repair features remain free, while Creator Pro is planned as an optional one-time purchase.',
  ));
  assert.match(english, /\[source-model transition\]\(SOURCE_TRANSITION\.md\)/);
  assert.ok(chinese.includes(
    '现有 LRC、SRT 和自动时间轴修复功能继续免费，Creator Pro 计划作为可选的一次性付费功能推出。',
  ));
  assert.match(chinese, /\[源码模式迁移说明\]\(SOURCE_TRANSITION\.md\)/);
});

test('README historical license boundary preserves published permissions', () => {
  const license = section(read('README.md'), '## Historical Source License');
  assert.ok(license.includes(
    'Version 2.0.9 and the public source recorded by `oss-source-cutoff` remain available under the permissions and representations in effect when published.',
  ));
  assert.ok(license.includes(
    'See [SOURCE_TRANSITION.md](SOURCE_TRANSITION.md) for the immutable tag, public archive, and transition details.',
  ));
  assert.doesNotMatch(license, /historical forks are unauthorized/i);
});

test('publication copy contains no placeholders or obsolete duration language', () => {
  const publicationCopy = `${read('README.md')}\n${read('SOURCE_TRANSITION.md')}`;
  assert.doesNotMatch(publicationCopy, /T[B]D|T[O]DO|coming soon|never open source/i);
  assert.doesNotMatch(publicationCopy, /14 full calendar days|至少完整 14 个日历日/);
});
