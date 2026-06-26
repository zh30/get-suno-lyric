import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { after, test } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = await mkdtemp(path.join(tmpdir(), 'get-suno-lyric-timing-'));
const outputDir = path.join(outputRoot, 'dist');

async function loadLyricTimingModule() {
  await rm(outputDir, { recursive: true, force: true });

  execFileSync(
    path.join(repoRoot, 'node_modules', '.bin', 'tsc'),
    [
      'src/scripts/lyricTiming.ts',
      '--target',
      'ES2020',
      '--module',
      'Node16',
      '--moduleResolution',
      'Node16',
      '--outDir',
      outputDir,
      '--skipLibCheck',
      '--strict',
      '--esModuleInterop',
      '--ignoreConfig'
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit'
    }
  );

  const candidates = [
    path.join(outputDir, 'lyricTiming.js'),
    path.join(outputDir, 'src', 'scripts', 'lyricTiming.js')
  ];
  const compiledModulePath = candidates.find((candidate) => existsSync(candidate));

  assert.ok(compiledModulePath, 'compiled lyricTiming.js should exist');
  const moduleUrl = pathToFileURL(compiledModulePath).href;
  return import(moduleUrl);
}

const lyricTimingModule = await loadLyricTimingModule();

after(() => rm(outputRoot, { recursive: true, force: true }));

test('does not synthesize prompt lines when adjacent aligned starts are identical', () => {
  const alignedLines = [
    { text: 'I will raise the tank', start_s: 66.22, end_s: 66.22 },
    { text: 'I will answer when the raid is calling', start_s: 66.22, end_s: 66.4 },
    { text: 'But pull aggro, do not blame me', start_s: 66.4, end_s: 67 }
  ];
  const prompt = [
    'I will raise the tank',
    'fallen',
    'I will answer when the raid is calling',
    'But pull aggro, do not blame me'
  ].join('\n');

  const result = lyricTimingModule.repairMissingPromptLines(alignedLines, prompt, 200);

  assert.equal(result.insertedCount, 0);
  assert.deepEqual(
    result.lines.map((line) => line.text),
    alignedLines.map((line) => line.text)
  );
});

test('does not compress many prompt lines into an implausibly small timing gap', () => {
  const alignedLines = [
    { text: 'Anchor one', start_s: 10, end_s: 10.2 },
    { text: 'Anchor two', start_s: 11, end_s: 12 }
  ];
  const prompt = [
    'Anchor one',
    'missing line one',
    'missing line two',
    'missing line three',
    'missing line four',
    'missing line five',
    'missing line six',
    'missing line seven',
    'missing line eight',
    'Anchor two'
  ].join('\n');

  const result = lyricTimingModule.repairMissingPromptLines(alignedLines, prompt, 120);

  assert.equal(result.insertedCount, 0);
  assert.deepEqual(
    result.lines.map((line) => line.text),
    alignedLines.map((line) => line.text)
  );
});

test('keeps a plausible single structural prompt repair', () => {
  const alignedLines = [
    { text: 'First sung line', start_s: 10, end_s: 12 },
    { text: 'Second sung line', start_s: 14, end_s: 16 }
  ];
  const prompt = [
    'First sung line',
    '[Chorus]',
    'Second sung line'
  ].join('\n');

  const result = lyricTimingModule.repairMissingPromptLines(alignedLines, prompt, 120);

  assert.equal(result.insertedCount, 1);
  assert.deepEqual(
    result.lines.map((line) => line.text),
    ['First sung line', '[Chorus]', 'Second sung line']
  );
  assert.ok(result.lines[1].start_s > result.lines[0].start_s);
  assert.ok(result.lines[1].start_s < result.lines[2].start_s);
});
