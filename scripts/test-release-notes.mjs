import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  buildReleaseNotes,
  categorizeCommitSubject,
  parseCommitSubject
} = require('./generate-release-notes.js');

test('parses conventional commit subjects with scopes', () => {
  assert.deepEqual(parseCommitSubject('feat(lyrics): strip Suno tags from downloads'), {
    type: 'feat',
    scope: 'lyrics',
    breaking: false,
    description: 'strip Suno tags from downloads'
  });

  assert.deepEqual(parseCommitSubject('fix!: require aligned timings for downloads'), {
    type: 'fix',
    scope: undefined,
    breaking: true,
    description: 'require aligned timings for downloads'
  });
});

test('categorizes commit subjects into release note groups', () => {
  assert.equal(categorizeCommitSubject('feat: add SRT download button').group, 'New');
  assert.equal(categorizeCommitSubject('fix: remove blank subtitle lines').group, 'Fixes');
  assert.equal(categorizeCommitSubject('refactor: extract lyric timing module').group, 'Improvements');
  assert.equal(categorizeCommitSubject('docs: update README').group, 'Documentation');
  assert.equal(categorizeCommitSubject('chore: upgrade dependencies').group, 'Maintenance');
});

test('infers useful groups for non-conventional commit subjects', () => {
  assert.equal(categorizeCommitSubject('Strip Suno tags from lyric downloads').group, 'Improvements');
  assert.equal(categorizeCommitSubject('Merge lyric fragments before repair').group, 'Improvements');
  assert.equal(categorizeCommitSubject('Add onboarding popup with i18n support').group, 'New');
  assert.equal(categorizeCommitSubject('Fix extension context invalidation').group, 'Fixes');
  assert.equal(categorizeCommitSubject('Upgrade build dependencies').group, 'Maintenance');
});

test('builds polished release notes with highlights, grouped changes, and changelog link', () => {
  const notes = buildReleaseNotes({
    version: '2.0.9',
    repo: 'zh30/get-suno-lyric',
    previousTag: 'v2.0.8',
    currentTag: 'v2.0.9',
    assetName: 'SunoLyricDownloader.zip',
    chromeWebStoreUrl: 'https://chromewebstore.google.com/detail/suno-lyric-downloader/hhplbhnaldbldkgfkcfjklfneggokijm',
    commits: [
      'feat(lyrics): strip Suno structure tags from LRC and SRT downloads',
      'fix(timing): merge lyric fragments before prompt repair',
      'docs: add sponsorship section'
    ]
  });

  assert.match(notes, /^# Suno Lyric Downloader v2\.0\.9/m);
  assert.match(notes, /## Highlights/);
  assert.match(notes, /- Strip Suno structure tags from LRC and SRT downloads/);
  assert.match(notes, /### Fixes/);
  assert.match(notes, /- Merge lyric fragments before prompt repair/);
  assert.match(notes, /`SunoLyricDownloader\.zip`/);
  assert.match(notes, /https:\/\/github\.com\/zh30\/get-suno-lyric\/compare\/v2\.0\.8\.\.\.v2\.0\.9/);
});

test('uses a useful maintenance fallback when no notable commits are available', () => {
  const notes = buildReleaseNotes({
    version: '2.0.9',
    repo: 'zh30/get-suno-lyric',
    previousTag: undefined,
    currentTag: 'v2.0.9',
    assetName: 'SunoLyricDownloader.zip',
    chromeWebStoreUrl: '',
    commits: []
  });

  assert.match(notes, /Maintenance release with packaging and dependency updates/);
  assert.match(notes, /https:\/\/github\.com\/zh30\/get-suno-lyric\/releases\/tag\/v2\.0\.9/);
});
