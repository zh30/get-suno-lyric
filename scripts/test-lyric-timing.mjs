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

test('merges standalone punctuation fragments into the previous lyric line', () => {
  const result = lyricTimingModule.mergeLyricLineFragments([
    { text: 'Hunter says, "That threat seems strange,', start_s: 45.55, end_s: 47.31 },
    { text: '"', start_s: 47.31, end_s: 47.31 },
    { text: 'Warlock taps and begs for more,', start_s: 47.31, end_s: 49.06 }
  ]);

  assert.deepEqual(
    result.map((line) => line.text),
    [
      'Hunter says, "That threat seems strange,"',
      'Warlock taps and begs for more,'
    ]
  );
  assert.equal(result[0].start_s, 45.55);
  assert.equal(result[0].end_s, 47.31);
});

test('merges short word suffix fragments into the previous lyric line', () => {
  const result = lyricTimingModule.mergeLyricLineFragments([
    { text: 'Because you stood where death was glowin', start_s: 136.51, end_s: 138.19 },
    { text: 'g,', start_s: 138.19, end_s: 138.27 },
    { text: 'Because your threat kept overflowing,', start_s: 138.27, end_s: 139.94 }
  ]);

  assert.deepEqual(
    result.map((line) => line.text),
    [
      'Because you stood where death was glowing,',
      'Because your threat kept overflowing,'
    ]
  );
  assert.equal(result[0].start_s, 136.51);
  assert.equal(result[0].end_s, 138.27);
});

test('uses prompt line boundaries to merge longer continuation fragments', () => {
  const prompt = [
    'I will heal the tank, I will raise the fallen,',
    'I will answer when the raid is calling,'
  ].join('\n');
  const result = lyricTimingModule.mergeLyricLineFragments([
    { text: 'I will heal the tank, I will raise the', start_s: 66.22, end_s: 67.68 },
    { text: 'fallen,', start_s: 67.68, end_s: 68.12 },
    { text: 'I will answer when the raid is calling,', start_s: 68.12, end_s: 70.1 }
  ], prompt);

  assert.deepEqual(
    result.map((line) => line.text),
    [
      'I will heal the tank, I will raise the fallen,',
      'I will answer when the raid is calling,'
    ]
  );
  assert.equal(result[0].start_s, 66.22);
  assert.equal(result[0].end_s, 68.12);
});

test('keeps legitimate short lyric lines separate', () => {
  const result = lyricTimingModule.mergeLyricLineFragments([
    { text: 'Oh', start_s: 10, end_s: 10.8 },
    { text: 'No', start_s: 11, end_s: 11.8 }
  ]);

  assert.deepEqual(
    result.map((line) => line.text),
    ['Oh', 'No']
  );
});

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
