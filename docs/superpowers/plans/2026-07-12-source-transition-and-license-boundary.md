# Source Transition and Proprietary 3.0 License Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve an independently verifiable public copy of the final open-source release, announce the source-model change transparently, wait a full 14-day notice period, make the existing repository private, and establish a tested proprietary `3.0.0` boundary before any Creator Pro code is added.

**Architecture:** A deterministic Node.js archive tool reads the immutable `v2.0.9` Git tree, adds narrowly scoped historical-license and provenance metadata, and emits a ZIP, checksum, and machine-readable manifest. The artifacts live in a public Cloudflare R2 bucket behind `downloads.zhanghe.dev`, so they remain reachable after GitHub becomes private. Two annotated Git tags record the start of the public notice and the final public-source cutoff. Only after the public artifacts, notice period, cutoff record, and externally reviewed EULA are all in place may the repository be made private and a single metadata-only `3.0.0` license-boundary commit be created.

**Tech Stack:** Node.js CommonJS scripts, `node:test`, `archiver`, Git, pnpm 11, GitHub CLI, Cloudflare R2/Wrangler, Rspack.

## Global Constraints

- `v2.0.9` must continue resolving to `98813c64624c4b98c7c80cdd63dd337e2198e8d9`. Abort immediately if it does not.
- Never move, recreate, force-push, delete, or rewrite `v2.0.9`, `source-transition-notice`, or `oss-source-cutoff`.
- Do not claim that making the repository private revokes historical rights, forks, or copies.
- Do not change GitHub visibility, push a tag, publish an announcement, upload to R2, or deploy anything without explicit user approval in the current session.
- The public notice must remain available for at least 14 complete 24-hour periods before `oss-source-cutoff` is created.
- Freeze ordinary public development after `source-transition-notice`; only critical fixes and transition-document corrections may enter `main` before the cutoff.
- Do not add Creator Pro implementation in this plan. The first proprietary commit is metadata, notices, packaging, and versioning only.
- Preserve the free `2.0.9` behavior: LRC download, SRT download, and automatic timing repair.
- This plan selects `suno-lyric-public-archives` as the R2 bucket and `downloads.zhanghe.dev` as its public custom domain. Confirm that domain choice before creating external resources; do not silently substitute another host.
- Do not change repository visibility until an externally reviewed EULA exists at `/Users/henry/legal/get-suno-lyric/CREATOR-PRO-EULA.approved.md`. The implementation agent must treat missing or draft legal text as a hard stop.
- Production JavaScript may remain normally minified. Do not add obfuscation, remote executable code, or post-purchase code downloads.

## File Structure

### Historical archive and transition tooling

- Create: `scripts/assets/MIT-LICENSE-2.0.9.txt` — MIT text included only as historical archive metadata.
- Create: `scripts/source-archive.js` — deterministic archive, checksum, and manifest library.
- Create: `scripts/package-source-archive.js` — command-line entry point.
- Create: `scripts/test-source-archive.mjs` — tag, provenance, archive-content, and determinism tests.
- Create: `scripts/write-source-cutoff-record.js` — validates the annotated cutoff tag and emits its public JSON record.
- Create: `scripts/write-historical-source-notice.js` — renders the proprietary tree's historical notice from the real cutoff tag.
- Create: `scripts/test-source-cutoff-record.mjs` — cutoff validation tests in a temporary Git repository.
- Create: `scripts/test-source-transition-docs.mjs` — prevents incomplete or misleading transition copy.
- Modify: `package.json` — runnable archive and test commands.
- Modify: `.gitignore` — exclude generated `release-artifacts/` files.

### Public communication

- Create: `SOURCE_TRANSITION.md` — durable bilingual announcement stored both in Git and R2.
- Modify: `README.md` — prominent transition link and historically accurate open-source wording.

### Proprietary boundary

- Create from approved external input: `LICENSE` — reviewed EULA for `3.0.0` and later.
- Create: `NOTICE-HISTORICAL-SOURCE.md` — immutable historical-source facts and archive links.
- Create: `scripts/generate-third-party-notices.js` — collects production dependency license texts.
- Create: `scripts/test-third-party-notices.mjs` — generator tests.
- Create generated output: `THIRD_PARTY_NOTICES.md` — bundled third-party notices.
- Create: `scripts/test-proprietary-boundary.mjs` — verifies the license boundary and package contents.
- Modify: `package.json` — version `3.0.0`, `private: true`, `license: UNLICENSED`, and legal scripts.
- Modify: `src/manifest.json` — version `3.0.0` only; no permission changes.
- Modify: `rspack.config.js` — copy legal notices into `dist/`.
- Modify: `README.md` — describe the current proprietary Freemium state accurately.

---

### Task 1: Build the Reproducible Historical-Source Archive

**Files:**

- Create: `scripts/assets/MIT-LICENSE-2.0.9.txt`
- Create: `scripts/source-archive.js`
- Create: `scripts/package-source-archive.js`
- Create: `scripts/test-source-archive.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: immutable Git tag `v2.0.9` at SHA `98813c64624c4b98c7c80cdd63dd337e2198e8d9`; existing `archiver` dependency.
- Produces: `assertExpectedTag(repoRoot, expectedSha?) -> string`, `buildProvenance() -> string`, `sha256File(filePath) -> string`, and `createSourceArchive({ repoRoot?, outputDir? }) -> Promise<{ archivePath, checksumPath, manifestPath, sha256 }>`.

- [ ] **Step 1: Add the historical MIT text**

Create `scripts/assets/MIT-LICENSE-2.0.9.txt` with the standard MIT License text and this copyright line:

```text
MIT License

Copyright (c) 2025-2026 Henry Zhang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The archive provenance must make clear that this file is archival metadata added outside the tagged tree; it must not claim that the existing tag contained a root `LICENSE` file.

- [ ] **Step 2: Write the failing archive tests**

Create `scripts/test-source-archive.mjs`:

```js
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
```

- [ ] **Step 3: Run the test and confirm an assertion fails before implementation**

Run:

```bash
node --test scripts/test-source-archive.mjs
```

Expected: non-zero exit with the assertion message `scripts/source-archive.js must exist`; the test process itself loads correctly.

- [ ] **Step 4: Implement the deterministic archive library**

Create `scripts/source-archive.js`:

```js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXPECTED_TAG = 'v2.0.9';
const EXPECTED_TAG_SHA = '98813c64624c4b98c7c80cdd63dd337e2198e8d9';
const ARCHIVE_FILENAME = 'get-suno-lyric-2.0.9-source.zip';
const ARCHIVE_PREFIX = 'get-suno-lyric-2.0.9';
const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00Z');
const PUBLIC_BASE_URL = 'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9';

function git(repoRoot, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function assertExpectedTag(repoRoot, expectedSha = EXPECTED_TAG_SHA) {
  const actualSha = git(repoRoot, ['rev-parse', `${EXPECTED_TAG}^{commit}`]).trim();
  if (actualSha !== expectedSha) {
    throw new Error(
      `${EXPECTED_TAG} resolves to ${actualSha}, which does not match the approved historical commit ${expectedSha}`,
    );
  }
  return actualSha;
}

function listTagFiles(repoRoot) {
  return git(repoRoot, ['ls-tree', '-r', '--name-only', EXPECTED_TAG])
    .split('\n')
    .filter(Boolean)
    .sort();
}

function readTagFile(repoRoot, filePath) {
  return git(repoRoot, ['show', `${EXPECTED_TAG}:${filePath}`], null);
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
  const manifestPath = path.join(outputDir, 'source-archive-manifest.json');
  const licensePath = path.join(__dirname, 'assets/MIT-LICENSE-2.0.9.txt');
  const output = fs.createWriteStream(archivePath);
  const { ZipArchive } = await import('archiver');
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const closed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);
  for (const filePath of listTagFiles(repoRoot)) {
    archive.append(readTagFile(repoRoot, filePath), {
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
      archiveUrl: `${PUBLIC_BASE_URL}/${ARCHIVE_FILENAME}`,
      checksumUrl: `${PUBLIC_BASE_URL}/${ARCHIVE_FILENAME}.sha256`,
    }, null, 2)}\n`,
  );

  return { archivePath, checksumPath, manifestPath, sha256 };
}

module.exports = {
  ARCHIVE_FILENAME,
  EXPECTED_TAG,
  EXPECTED_TAG_SHA,
  assertExpectedTag,
  buildProvenance,
  createSourceArchive,
  sha256File,
};
```

- [ ] **Step 5: Add the CLI, package commands, and ignored output**

Create `scripts/package-source-archive.js`:

```js
const path = require('node:path');
const { createSourceArchive } = require('./source-archive.js');

async function main() {
  const outputDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../release-artifacts/get-suno-lyric/v2.0.9');
  const result = await createSourceArchive({ outputDir });
  console.log(`Archive: ${result.archivePath}`);
  console.log(`Checksum: ${result.checksumPath}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`SHA-256: ${result.sha256}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Add these scripts to `package.json`, and replace the placeholder aggregate test:

```json
"test": "pnpm test:release-notes && pnpm test:release-workflow && pnpm test:lyric-timing && pnpm test:source-archive",
"test:source-archive": "node --test scripts/test-source-archive.mjs",
"source:archive": "node scripts/package-source-archive.js"
```

Append to `.gitignore`:

```text
release-artifacts/
```

- [ ] **Step 6: Run the focused and aggregate tests**

Run:

```bash
pnpm test:source-archive
pnpm test
```

Expected: every subtest passes and both commands exit `0`.

- [ ] **Step 7: Generate and independently inspect the artifacts**

Run:

```bash
pnpm source:archive
(cd release-artifacts/get-suno-lyric/v2.0.9 && shasum -a 256 -c get-suno-lyric-2.0.9-source.zip.sha256)
unzip -Z1 release-artifacts/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip | rg 'package.json|LICENSE-MIT.txt|SOURCE_PROVENANCE.txt'
git rev-parse 'v2.0.9^{commit}'
```

Expected:

- Checksum reports `OK`.
- The three required paths are listed.
- Git prints exactly `98813c64624c4b98c7c80cdd63dd337e2198e8d9`.

- [ ] **Step 8: Commit the archive tooling**

```bash
git add .gitignore package.json scripts/assets/MIT-LICENSE-2.0.9.txt scripts/source-archive.js scripts/package-source-archive.js scripts/test-source-archive.mjs
git commit -m "build: add reproducible historical source archive"
```

---

### Task 2: Add the Public Transition Announcement and Guardrails

**Files:**

- Create: `SOURCE_TRANSITION.md`
- Create: `scripts/test-source-transition-docs.mjs`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: the stable archive and cutoff URLs defined by Task 1.
- Produces: `SOURCE_TRANSITION.md` as the canonical public message, plus `test:source-transition-docs` as the copy contract used before publication.

- [ ] **Step 1: Write the failing documentation contract test**

Create `scripts/test-source-transition-docs.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and confirm the missing announcement failure**

Run:

```bash
node --test scripts/test-source-transition-docs.mjs
```

Expected: non-zero exit with the assertion message `SOURCE_TRANSITION.md must exist`; no uncaught filesystem error occurs.

- [ ] **Step 3: Write the bilingual announcement**

Create `SOURCE_TRANSITION.md` exactly as follows:

```md
# Suno Lyric Downloader source-model transition

## English

Suno Lyric Downloader 2.0.9 is the final open-source product release. Extension version 3.0.0 and later are proprietary.

### What stays free

LRC download, SRT download, and automatic timing repair remain free. Existing users keep the same Chrome Web Store extension and continue receiving normal updates through the existing extension ID.

Creator Pro is an optional one-time purchase. It adds creator workflow features without removing or degrading the free 2.0.9 capabilities.

### Privacy

Song data, lyrics, audio, projects, and videos remain local. Only checkout and license validation use developer-controlled services.

### Historical source and notice period

The repository remains public for at least 14 full calendar days after the annotated `source-transition-notice` tag is published. Immediately before privatization, the annotated `oss-source-cutoff` tag records the final public repository state.

All source made public through `oss-source-cutoff` keeps the permissions and representations under which it was published. Making the main repository private does not revoke or delete historical copies, forks, or permissions already received.

The final open-source product release is:

- Tag: `v2.0.9`
- Commit: `98813c64624c4b98c7c80cdd63dd337e2198e8d9`
- [Source archive](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip)
- [SHA-256 checksum](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256)
- [Archive manifest](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/source-archive-manifest.json)
- [Final public-source cutoff record](https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json)

## 中文

Suno Lyric Downloader 2.0.9 是最后一个开源产品版本。插件 3.0.0 及以后版本采用专有许可。

### 哪些功能继续免费

LRC 下载、SRT 下载和现有自动时间轴修复将继续免费。现有用户继续使用同一个 Chrome 应用商店插件和原有插件 ID，并通过正常更新渠道获得后续版本。

Creator Pro 是可选的一次性付费功能。它增加创作者工作流能力，但不会移除或降低 2.0.9 已有免费能力的质量。

### 隐私

歌曲数据、歌词、音频、项目和视频都保留在本地。只有结账和许可证验证会使用开发者控制的服务。

### 历史源码和公示期

在带注释的 `source-transition-notice` 标签发布后，仓库将继续公开至少完整 14 个日历日。转为私有前，会用带注释的 `oss-source-cutoff` 标签记录最后的公开仓库状态。

截至 `oss-source-cutoff` 已公开的源码，继续保留其公开时已获得的许可和表述。主仓库转为私有不会撤销或删除历史副本、分叉仓库，或用户此前已经获得的许可。

最后一个开源产品版本为：

- 标签：`v2.0.9`
- 提交：`98813c64624c4b98c7c80cdd63dd337e2198e8d9`
- [源码归档](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip)
- [SHA-256 校验文件](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256)
- [归档清单](https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/source-archive-manifest.json)
- [最终公开源码截止记录](https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json)
```

- [ ] **Step 4: Update README while the repository is still public**

Immediately below `# Suno Lyric Downloader`, insert:

```md
> **Source-model notice:** Version 2.0.9 is the final open-source product release. Existing download features remain free; version 3.0.0 and later will use a proprietary Freemium model. Read the [full transition announcement](SOURCE_TRANSITION.md).
>
> **源码模式变更说明：** 2.0.9 是最后一个开源产品版本。现有歌词下载功能将继续免费；3.0.0 及以后版本采用闭源 Freemium 模式。请阅读[完整迁移公告](SOURCE_TRANSITION.md)。
```

Replace the English support sentence that currently calls the whole current product open source with:

```md
Suno Lyric Downloader 2.0.9 is the final open-source product release. The existing LRC, SRT, and automatic timing-repair features remain free, while Creator Pro is a future optional one-time purchase. See the [source-model transition](SOURCE_TRANSITION.md) for the historical source boundary.
```

Replace the equivalent Chinese sentence with:

```md
Suno Lyric Downloader 2.0.9 是最后一个开源产品版本。现有 LRC、SRT 和自动时间轴修复功能将继续免费，Creator Pro 则是后续可选的一次性付费功能。历史源码边界请参阅[源码模式迁移说明](SOURCE_TRANSITION.md)。
```

Replace the final `## License` / `MIT` block with:

```md
## Historical Source License

Version 2.0.9 and the public source recorded by `oss-source-cutoff` remain available under the permissions and representations in effect when published. See [SOURCE_TRANSITION.md](SOURCE_TRANSITION.md) for the immutable tag, public archive, and transition details.
```

- [ ] **Step 5: Add the documentation test to the aggregate suite**

Add to `package.json`:

```json
"test:source-transition-docs": "node --test scripts/test-source-transition-docs.mjs"
```

Append `&& pnpm test:source-transition-docs` to the existing `test` command.

- [ ] **Step 6: Run tests and scan for misleading copy**

Run:

```bash
pnpm test:source-transition-docs
pnpm test
! rg -n "free, open source|免费、开源|^MIT$|T[B]D|T[O]DO" README.md SOURCE_TRANSITION.md
```

Expected: tests pass; `rg` returns no obsolete present-tense product claim and no placeholder text.

- [ ] **Step 7: Commit the public communication**

```bash
git add README.md SOURCE_TRANSITION.md package.json scripts/test-source-transition-docs.mjs
git commit -m "docs: announce source model transition"
```

---

### Task 3: Make the Final Public Cutoff Machine-Verifiable

**Files:**

- Create: `scripts/write-source-cutoff-record.js`
- Create: `scripts/write-historical-source-notice.js`
- Create: `scripts/test-source-cutoff-record.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: annotated Git tag `oss-source-cutoff` and a clean working tree.
- Produces: `readCutoff(repoRoot, { requireClean? }?) -> CutoffRecord`, `writeCutoffRecord({ repoRoot, outputPath }) -> CutoffRecord`, `renderHistoricalSourceNotice(record) -> string`, the public `oss-source-cutoff.json` artifact, and a generated `NOTICE-HISTORICAL-SOURCE.md` with the real SHA.

- [ ] **Step 1: Write failing cutoff-record tests**

Create `scripts/test-source-cutoff-record.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'write-source-cutoff-record.js',
);

function loadCutoffModule() {
  assert.equal(
    fs.existsSync(modulePath),
    true,
    'scripts/write-source-cutoff-record.js must exist',
  );
  return require(modulePath);
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function makeRepo({ annotated = true } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suno-cutoff-test-'));
  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.name', 'Source Transition Test']);
  git(repoRoot, ['config', 'user.email', 'source-transition@example.test']);
  fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'public source\n');
  git(repoRoot, ['add', 'file.txt']);
  git(repoRoot, ['commit', '-m', 'test public source']);
  const tagArgs = annotated
    ? ['tag', '-a', 'oss-source-cutoff', '-m', 'test cutoff']
    : ['tag', 'oss-source-cutoff'];
  git(repoRoot, tagArgs);
  return repoRoot;
}

test('reads an annotated cutoff and renders the exact historical notice', () => {
  const {
    readCutoff,
    renderHistoricalSourceNotice,
    writeCutoffRecord,
  } = loadCutoffModule();
  const repoRoot = makeRepo();
  const record = readCutoff(repoRoot);
  const expectedCommit = git(repoRoot, ['rev-parse', 'oss-source-cutoff^{commit}']);
  const expectedDate = git(repoRoot, [
    'for-each-ref',
    '--format=%(taggerdate:iso-strict)',
    'refs/tags/oss-source-cutoff',
  ]);
  assert.equal(record.commit, expectedCommit);
  assert.equal(record.taggedAt, expectedDate);

  const notice = renderHistoricalSourceNotice(record);
  assert.ok(notice.includes(expectedCommit));
  assert.ok(notice.includes('98813c64624c4b98c7c80cdd63dd337e2198e8d9'));
  assert.match(notice, /does not revoke/i);

  const outputPath = path.join(os.tmpdir(), `${expectedCommit}-cutoff.json`);
  const written = writeCutoffRecord({ repoRoot, outputPath });
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), written);
});

test('rejects a lightweight cutoff tag', () => {
  const { readCutoff } = loadCutoffModule();
  assert.throws(() => readCutoff(makeRepo({ annotated: false })), /must be an annotated tag/);
});

test('rejects a dirty working tree', () => {
  const { readCutoff } = loadCutoffModule();
  const repoRoot = makeRepo();
  fs.writeFileSync(path.join(repoRoot, 'uncommitted.txt'), 'dirty\n');
  assert.throws(() => readCutoff(repoRoot), /working tree must be clean/);
});

test('refuses to replace a record for another commit', () => {
  const { writeCutoffRecord } = loadCutoffModule();
  const repoRoot = makeRepo();
  const outputPath = path.join(os.tmpdir(), `${path.basename(repoRoot)}-cutoff.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ commit: '0'.repeat(40) })}\n`);
  assert.throws(
    () => writeCutoffRecord({ repoRoot, outputPath }),
    /existing cutoff record points to a different commit/,
  );
});
```

- [ ] **Step 2: Run the failing test**

```bash
node --test scripts/test-source-cutoff-record.mjs
```

Expected: non-zero exit with the assertion message `scripts/write-source-cutoff-record.js must exist`; the test file itself executes normally.

- [ ] **Step 3: Implement the cutoff-record library and CLI**

Create `scripts/write-source-cutoff-record.js` with these exported functions:

```js
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
```

Create `scripts/write-historical-source-notice.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const {
  readCutoff,
  renderHistoricalSourceNotice,
} = require('./write-source-cutoff-record.js');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'NOTICE-HISTORICAL-SOURCE.md');
const record = readCutoff(repoRoot, { requireClean: false });
fs.writeFileSync(outputPath, renderHistoricalSourceNotice(record));
console.log(`Historical source notice: ${outputPath}`);
```

- [ ] **Step 4: Add and run the package command**

Add:

```json
"source:cutoff-record": "node scripts/write-source-cutoff-record.js",
"source:historical-notice": "node scripts/write-historical-source-notice.js",
"test:source-cutoff": "node --test scripts/test-source-cutoff-record.mjs"
```

Append `&& pnpm test:source-cutoff` to `test`, then run:

```bash
pnpm test:source-cutoff
pnpm test
```

Expected: all tests pass. Do not run `pnpm source:cutoff-record` yet because the real cutoff tag must not exist before the notice period ends.

- [ ] **Step 5: Commit the cutoff tooling**

```bash
git add package.json scripts/write-source-cutoff-record.js scripts/write-historical-source-notice.js scripts/test-source-cutoff-record.mjs
git commit -m "build: add verifiable public source cutoff record"
```

---

### Task 4: Publish the Historical Archive and Start the Notice Period

**Interfaces:**

- Consumes: Task 1 artifacts and Task 2 announcement from a clean, reviewed branch.
- Produces: four public R2 objects and annotated tag `source-transition-notice`, whose tagger timestamp is the sole start time for the 14-day gate.

**External-state gate:** Stop and obtain explicit current-session approval before the first R2, DNS, Git push, or tag command in this task.

- [ ] **Step 1: Complete local quality gates before publication**

```bash
pnpm install --frozen-lockfile
pnpm tsc
pnpm test
pnpm build
pnpm source:archive
git status --short
```

Expected: all commands exit `0`; only ignored `release-artifacts/` exists outside Git; the tracked working tree is clean.

- [ ] **Step 2: Create or verify the public R2 bucket**

After approval, authenticate Wrangler with a narrowly scoped Cloudflare API token and run:

```bash
pnpm dlx wrangler r2 bucket create suno-lyric-public-archives
```

If the bucket already exists, verify ownership instead of recreating it:

```bash
pnpm dlx wrangler r2 bucket list
```

Expected: `suno-lyric-public-archives` appears once.

- [ ] **Step 3: Bind the exact public domain**

Use Wrangler's R2 custom-domain command; do not enable a mutable `r2.dev` development URL as the documented location:

```bash
pnpm dlx wrangler r2 bucket domain add suno-lyric-public-archives --domain downloads.zhanghe.dev
pnpm dlx wrangler r2 bucket domain get suno-lyric-public-archives --domain downloads.zhanghe.dev
```

Wait until the returned ownership and TLS states are active, then verify DNS and TLS:

```bash
curl --silent --show-error --head https://downloads.zhanghe.dev/
```

Expected: a valid HTTPS response. A `404` object response is acceptable before upload; DNS or TLS errors are not.

- [ ] **Step 4: Upload the archive, checksum, manifest, and announcement**

```bash
pnpm dlx wrangler r2 object put suno-lyric-public-archives/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip --file=release-artifacts/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip --content-type=application/zip --remote
pnpm dlx wrangler r2 object put suno-lyric-public-archives/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256 --file=release-artifacts/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256 --content-type=text/plain --remote
pnpm dlx wrangler r2 object put suno-lyric-public-archives/get-suno-lyric/v2.0.9/source-archive-manifest.json --file=release-artifacts/get-suno-lyric/v2.0.9/source-archive-manifest.json --content-type=application/json --remote
pnpm dlx wrangler r2 object put suno-lyric-public-archives/get-suno-lyric/SOURCE_TRANSITION.md --file=SOURCE_TRANSITION.md --content-type=text/markdown --remote
```

- [ ] **Step 5: Verify the public bytes independently**

```bash
mkdir -p /tmp/get-suno-lyric-source-verification
curl --fail --silent --show-error --location https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip --output /tmp/get-suno-lyric-source-verification/get-suno-lyric-2.0.9-source.zip
curl --fail --silent --show-error --location https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip.sha256 --output /tmp/get-suno-lyric-source-verification/get-suno-lyric-2.0.9-source.zip.sha256
curl --fail --silent --show-error --location https://downloads.zhanghe.dev/get-suno-lyric/SOURCE_TRANSITION.md --output /tmp/get-suno-lyric-source-verification/SOURCE_TRANSITION.md
cmp SOURCE_TRANSITION.md /tmp/get-suno-lyric-source-verification/SOURCE_TRANSITION.md
(cd /tmp/get-suno-lyric-source-verification && shasum -a 256 -c get-suno-lyric-2.0.9-source.zip.sha256)
```

Expected: `cmp` exits `0` and the checksum command prints `get-suno-lyric-2.0.9-source.zip: OK`.

- [ ] **Step 6: Publish Git changes, then create the notice tag**

Push only after the archive URLs are live and reviewed:

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git tag -a source-transition-notice -m "Start 14-day public notice for the 3.0.0 source-model transition"
git push origin source-transition-notice
git show --no-patch --format=fuller source-transition-notice
```

Expected: an annotated tag whose tagger date is visible. Record that timestamp in the operator log; it starts the 14-day clock.

- [ ] **Step 7: Stop for the full notice period**

Do not use a blocking sleep command. End the implementation session and report the earliest eligible cutoff timestamp, calculated as the annotated tag's tagger timestamp plus 14 complete 24-hour periods.

---

### Task 5: Record the Final Public State and Make the Repository Private

**Interfaces:**

- Consumes: live public archive URLs, an elapsed `source-transition-notice` tag, and the approved EULA prerequisite.
- Produces: annotated `oss-source-cutoff`, public `oss-source-cutoff.json`, and verified `PRIVATE` visibility for `zh30/get-suno-lyric`.

**External-state gate:** This task begins only after the full notice period, after the EULA prerequisite exists, and after fresh explicit approval to tag and change GitHub visibility.

- [ ] **Step 1: Revalidate every prerequisite**

```bash
test -s /Users/henry/legal/get-suno-lyric/CREATOR-PRO-EULA.approved.md
! rg -n "DRAFT|T[B]D|T[O]DO|NOT LEGAL ADVICE" /Users/henry/legal/get-suno-lyric/CREATOR-PRO-EULA.approved.md
git status --short
git fetch origin --tags
git rev-parse 'v2.0.9^{commit}'
git cat-file -t refs/tags/source-transition-notice
curl --fail --silent --show-error --head https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip
```

Expected:

- EULA checks exit `0`.
- Working tree is clean and current `main` equals `origin/main`.
- `v2.0.9` prints the approved SHA.
- The notice tag type is `tag`.
- The archive returns a successful public response.

Calculate elapsed time from the tag itself; require at least `1209600` seconds:

```bash
node -e "const {execFileSync}=require('node:child_process'); const tagged=Number(execFileSync('git',['for-each-ref','--format=%(taggerdate:unix)','refs/tags/source-transition-notice'],{encoding:'utf8'}).trim()); const elapsed=Math.floor(Date.now()/1000)-tagged; if(elapsed<1209600){throw new Error('14-day notice period has not completed')} console.log(elapsed)"
```

- [ ] **Step 2: Freeze and tag the final public commit**

After explicit approval:

```bash
git fetch origin main
git status --short
git tag -a oss-source-cutoff origin/main -m "Final public source state before proprietary 3.0.0"
git push origin oss-source-cutoff
git rev-parse 'oss-source-cutoff^{commit}'
git cat-file -t refs/tags/oss-source-cutoff
```

Expected: a 40-character SHA and tag type `tag`. Save the exact SHA for the next task.

- [ ] **Step 3: Generate and publish the cutoff JSON**

```bash
pnpm source:cutoff-record
pnpm dlx wrangler r2 object put suno-lyric-public-archives/get-suno-lyric/oss-source-cutoff.json --file=release-artifacts/get-suno-lyric/oss-source-cutoff.json --content-type=application/json --remote
curl --fail --silent --show-error https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json
```

Expected: public JSON contains the exact SHA printed in Step 2 and the approved `v2.0.9` SHA.

- [ ] **Step 4: Make the existing repository private**

Only after all public URLs and the cutoff tag are verified:

```bash
gh repo edit zh30/get-suno-lyric --visibility private --accept-visibility-change-consequences
gh repo view zh30/get-suno-lyric --json visibility -q .visibility
```

Expected: `PRIVATE`.

- [ ] **Step 5: Verify private operations without changing product code**

```bash
git fetch origin
gh workflow list --repo zh30/get-suno-lyric
curl --fail --silent --show-error --head https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip
```

Expected: Git access still works for the owner, workflows remain visible to the owner, and the archive remains publicly reachable without GitHub authentication.

---

### Task 6: Establish the Proprietary `3.0.0` Boundary

**Files:**

- Create from reviewed input: `LICENSE`
- Create: `NOTICE-HISTORICAL-SOURCE.md`
- Create: `scripts/test-proprietary-boundary.mjs`
- Modify: `package.json`
- Modify: `src/manifest.json`
- Modify: `rspack.config.js`
- Modify: `README.md`

**Interfaces:**

- Consumes: counsel-approved EULA bytes, the real `oss-source-cutoff` tag, and the production dependency tree from `pnpm-lock.yaml`.
- Produces: a single metadata-only `3.0.0` boundary commit, packaged legal notices, `generateThirdPartyNotices({ repoRoot, outputPath }) -> string`, and a green `test:proprietary-boundary` contract.

- [ ] **Step 1: Write the failing boundary test before changing metadata**

Create `scripts/test-proprietary-boundary.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => {
  const filePath = path.join(repoRoot, file);
  assert.equal(fs.existsSync(filePath), true, `${file} must exist`);
  return fs.readFileSync(filePath, 'utf8');
};

test('package and extension begin the proprietary line at 3.0.0', () => {
  const packageJson = JSON.parse(read('package.json'));
  const manifest = JSON.parse(read('src/manifest.json'));
  assert.equal(packageJson.version, '3.0.0');
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.license, 'UNLICENSED');
  assert.equal(manifest.version, '3.0.0');
});

test('legal boundary preserves the historical source record', () => {
  const license = read('LICENSE');
  const historicalNotice = read('NOTICE-HISTORICAL-SOURCE.md');
  const cutoff = execFileSync('git', ['rev-parse', 'oss-source-cutoff^{commit}'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  assert.doesNotMatch(license, /DRAFT|T[B]D|T[O]DO/);
  assert.match(historicalNotice, /v2\.0\.9/);
  assert.ok(historicalNotice.includes('98813c64624c4b98c7c80cdd63dd337e2198e8d9'));
  assert.ok(historicalNotice.includes(cutoff));
  assert.ok(historicalNotice.includes(
    'https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip',
  ));
  assert.match(historicalNotice, /does not revoke/i);
});

test('the distributed extension contains all legal notices', () => {
  for (const file of ['LICENSE.txt', 'NOTICE-HISTORICAL-SOURCE.md', 'THIRD_PARTY_NOTICES.md']) {
    assert.ok(fs.existsSync(path.join(repoRoot, 'dist', file)), `dist/${file} is missing`);
  }
});

test('readme no longer describes 3.x as an open-source product', () => {
  const readme = read('README.md');
  assert.doesNotMatch(readme, /Suno Lyric Downloader is free, open source/);
  assert.doesNotMatch(readme, /Suno Lyric Downloader 是一个免费、开源/);
  assert.match(readme, /proprietary Freemium/);
  assert.match(readme, /闭源 Freemium/);
});
```

- [ ] **Step 2: Run the test and confirm the expected red state**

```bash
node --test scripts/test-proprietary-boundary.mjs
```

Expected: assertion failures for version `2.0.9`, missing `private`, missing legal files, and missing `dist` notices; no uncaught missing-file error occurs.

- [ ] **Step 3: Add the reviewed EULA verbatim**

Read `/Users/henry/legal/get-suno-lyric/CREATOR-PRO-EULA.approved.md` and use `apply_patch` to create root `LICENSE` with exactly that reviewed text. Do not paraphrase, generate, or silently edit legal clauses. Confirm its scope explicitly covers Suno Lyric Downloader extension version `3.0.0` and later; if it does not, stop and return it for legal correction.

- [ ] **Step 4: Add the historical-source notice with the real cutoff SHA**

Run:

```bash
pnpm source:historical-notice
EXPECTED_CUTOFF="$(git rev-parse 'oss-source-cutoff^{commit}')"
rg -F "$EXPECTED_CUTOFF" NOTICE-HISTORICAL-SOURCE.md
```

Expected: the generator from Task 3 writes `NOTICE-HISTORICAL-SOURCE.md`, and `rg` prints the line containing the exact peeled cutoff SHA. Do not hand-edit the generated notice.

- [ ] **Step 5: Change only version and license metadata**

Update `package.json`:

```json
"version": "3.0.0",
"private": true,
"license": "UNLICENSED"
```

Update only `version` in `src/manifest.json`:

```json
"version": "3.0.0"
```

Do not add permissions, host permissions, license-network endpoints, Pro UI, or entitlement code in this commit.

- [ ] **Step 6: Copy legal notices into the store package**

Add these entries to `rspack.CopyRspackPlugin` in `rspack.config.js`:

```js
{ from: 'LICENSE', to: 'LICENSE.txt' },
{ from: 'NOTICE-HISTORICAL-SOURCE.md', to: 'NOTICE-HISTORICAL-SOURCE.md' },
{ from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' },
```

The build will remain red until Task 6B creates `THIRD_PARTY_NOTICES.md`; do not weaken the copy rule.

- [ ] **Step 7: Update README for the private `3.x` source tree**

Replace the transition banner with:

```md
> **Product model:** Suno Lyric Downloader 3.x is a proprietary Freemium extension. LRC download, SRT download, and automatic timing repair remain free. Creator Pro is an optional one-time purchase. Historical 2.0.9 source remains available through the [source transition notice](SOURCE_TRANSITION.md).
>
> **产品模式：** Suno Lyric Downloader 3.x 是闭源 Freemium 插件。LRC 下载、SRT 下载和自动时间轴修复将继续免费，Creator Pro 是可选的一次性付费功能。2.0.9 历史源码仍可通过[源码迁移说明](SOURCE_TRANSITION.md)获取。
```

Replace the historical license section with:

```md
## Licensing

Suno Lyric Downloader 3.0.0 and later are distributed under the proprietary terms in [LICENSE](LICENSE). Historical public source is documented in [NOTICE-HISTORICAL-SOURCE.md](NOTICE-HISTORICAL-SOURCE.md). Third-party software remains under its own terms, collected in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
```

- [ ] **Step 8: Add the boundary test command but do not commit yet**

Add:

```json
"test:proprietary-boundary": "node --test scripts/test-proprietary-boundary.mjs"
```

Append it to `test`. Keep the changes uncommitted until Task 6B makes all tests green.

---

#### Task 6B: Generate Complete Third-Party Notices Before Committing the Boundary

**Files:**

- Create: `scripts/generate-third-party-notices.js`
- Create: `scripts/test-third-party-notices.mjs`
- Create generated output: `THIRD_PARTY_NOTICES.md`
- Modify: `package.json`

- [ ] **Step 1: Write focused generator tests**

Create `scripts/test-third-party-notices.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'generate-third-party-notices.js',
);

function loadNoticeModule() {
  assert.equal(
    fs.existsSync(modulePath),
    true,
    'scripts/generate-third-party-notices.js must exist',
  );
  return require(modulePath);
}

function makePackage(root, { name, version, licenseFile, licenseText }) {
  const packagePath = path.join(root, `${name}-${version}`);
  fs.mkdirSync(packagePath, { recursive: true });
  fs.writeFileSync(
    path.join(packagePath, 'package.json'),
    `${JSON.stringify({ name, version, homepage: `https://example.test/${name}` })}\n`,
  );
  if (licenseFile) {
    fs.writeFileSync(path.join(packagePath, licenseFile), licenseText);
  }
  return packagePath;
}

test('findLicenseFile uses the first sorted recognized license file', () => {
  const { findLicenseFile } = loadNoticeModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-file-test-'));
  const packagePath = makePackage(root, {
    name: 'alpha',
    version: '1.0.0',
    licenseFile: 'LICENSE.md',
    licenseText: 'Alpha license text\n',
  });
  fs.writeFileSync(path.join(packagePath, 'NOTICE'), 'Notice text\n');
  assert.deepEqual(findLicenseFile(packagePath), {
    fileName: 'LICENSE.md',
    text: 'Alpha license text\n',
  });
});

test('normalizes, deduplicates, sorts, and renders packages without local paths', () => {
  const { normalizePackages, renderThirdPartyNotices } = loadNoticeModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-render-test-'));
  const zeta = makePackage(root, {
    name: 'zeta',
    version: '2.0.0',
    licenseFile: 'LICENSE',
    licenseText: 'Zeta full license\nSecond line\n',
  });
  const alpha = makePackage(root, {
    name: 'alpha',
    version: '1.0.0',
    licenseFile: 'COPYING.txt',
    licenseText: 'Alpha full license\n',
  });
  const missing = makePackage(root, {
    name: 'missing-license',
    version: '3.0.0',
    licenseFile: null,
    licenseText: '',
  });
  const report = {
    MIT: [{ name: 'zeta', license: 'MIT', paths: [zeta, zeta] }],
    Apache: [{ name: 'alpha', license: 'Apache-2.0', paths: [alpha] }],
    Unknown: [{ name: 'missing-license', license: 'Unknown', paths: [missing] }],
  };

  const packages = normalizePackages(report);
  assert.deepEqual(packages.map((item) => `${item.name}@${item.version}`), [
    'alpha@1.0.0',
    'missing-license@3.0.0',
    'zeta@2.0.0',
  ]);

  const output = renderThirdPartyNotices(packages);
  assert.equal(output.match(/## zeta@2\.0\.0/g)?.length, 1);
  assert.match(output, /Zeta full license\n    Second line/);
  assert.match(output, /LICENSE FILE NOT FOUND/);
  assert.ok(!output.includes(root));
});
```

Run this test before implementation and expect the assertion message `scripts/generate-third-party-notices.js must exist`; the test process itself must not crash while loading.

- [ ] **Step 2: Implement the notice generator**

Create `scripts/generate-third-party-notices.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LICENSE_FILE_PATTERN = /^(license|licence|copying|notice)(\..*)?$/i;

function findLicenseFile(packagePath) {
  const fileName = fs.readdirSync(packagePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))[0];
  if (!fileName) {
    return null;
  }
  return {
    fileName,
    text: fs.readFileSync(path.join(packagePath, fileName), 'utf8'),
  };
}

function normalizePackages(licenseReport) {
  const packages = new Map();
  for (const [licenseGroup, entries] of Object.entries(licenseReport)) {
    for (const entry of entries) {
      for (const packagePath of [...(entry.paths ?? [])].sort()) {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'),
        );
        const key = `${packageJson.name}@${packageJson.version}`;
        if (packages.has(key)) {
          continue;
        }
        const licenseFile = findLicenseFile(packagePath);
        packages.set(key, {
          name: packageJson.name,
          version: packageJson.version,
          declaredLicense: entry.license || licenseGroup,
          homepage: entry.homepage || packageJson.homepage || 'Not provided',
          licenseFile: licenseFile?.fileName ?? null,
          licenseText: licenseFile?.text ?? 'LICENSE FILE NOT FOUND\n',
        });
      }
    }
  }
  return [...packages.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
  );
}

function renderThirdPartyNotices(packages) {
  const lines = [
    '# Third-Party Notices',
    '',
    'Suno Lyric Downloader includes or uses the packages listed below.',
    'Each package remains governed by its own license; inclusion here does not change those terms.',
    '',
  ];
  for (const item of packages) {
    lines.push(
      `## ${item.name}@${item.version}`,
      '',
      `- Declared license: ${item.declaredLicense}`,
      `- Homepage: ${item.homepage}`,
      `- License file: ${item.licenseFile ?? 'not found'}`,
      '',
      '### License text',
      '',
      ...item.licenseText.replace(/\r\n/g, '\n').split('\n').map((line) => `    ${line}`),
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function generateThirdPartyNotices({
  repoRoot = path.resolve(__dirname, '..'),
  outputPath = path.resolve(__dirname, '../THIRD_PARTY_NOTICES.md'),
} = {}) {
  const report = JSON.parse(execFileSync(
    'pnpm',
    ['licenses', 'list', '--prod', '--json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ));
  const output = renderThirdPartyNotices(normalizePackages(report));
  fs.writeFileSync(outputPath, output);
  return output;
}

if (require.main === module) {
  const output = generateThirdPartyNotices();
  console.log(`Third-party notices generated: ${Buffer.byteLength(output)} bytes`);
}

module.exports = {
  findLicenseFile,
  generateThirdPartyNotices,
  normalizePackages,
  renderThirdPartyNotices,
};
```

- [ ] **Step 3: Add commands and run red-to-green verification**

Add:

```json
"legal:third-party": "node scripts/generate-third-party-notices.js",
"test:third-party-notices": "node --test scripts/test-third-party-notices.mjs"
```

Append the focused test to `test`, then run:

```bash
pnpm test:third-party-notices
pnpm legal:third-party
! rg -n "LICENSE FILE NOT FOUND|/Users/henry|node_modules/.pnpm" THIRD_PARTY_NOTICES.md
```

Expected: test passes; the generated file has no absolute paths. If any license file is missing, resolve it from the dependency's authoritative package source before continuing; do not commit an unresolved marker.

- [ ] **Step 4: Build and make the boundary tests green**

```bash
pnpm build
pnpm test:proprietary-boundary
pnpm test
```

Expected: all legal files exist in `dist/`, the actual cutoff SHA matches the notice, and every test passes.

- [ ] **Step 5: Inspect the exact boundary diff**

```bash
git diff -- package.json src/manifest.json rspack.config.js README.md LICENSE NOTICE-HISTORICAL-SOURCE.md THIRD_PARTY_NOTICES.md scripts/test-proprietary-boundary.mjs scripts/generate-third-party-notices.js scripts/test-third-party-notices.mjs
git diff --check
```

Expected: no Pro implementation, new permission, endpoint, secret, or whitespace error appears.

- [ ] **Step 6: Commit the single proprietary boundary**

```bash
git add package.json src/manifest.json rspack.config.js README.md LICENSE NOTICE-HISTORICAL-SOURCE.md THIRD_PARTY_NOTICES.md scripts/test-proprietary-boundary.mjs scripts/generate-third-party-notices.js scripts/test-third-party-notices.mjs
git commit -m "chore: establish proprietary 3.0 license boundary"
```

Record this commit SHA in the implementation handoff. It must precede every Creator Pro implementation commit.

---

### Task 7: Final Verification and Next-Plan Handoff

**Interfaces:**

- Consumes: the completed Task 6 boundary commit and all immutable public records.
- Produces: a clean verification record and the explicit handoff point for the separate video-feasibility implementation plan.

- [ ] **Step 1: Run every local quality gate from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm tsc
pnpm test
pnpm build
pnpm zip
git status --short
```

Expected: all commands exit `0`; the tracked working tree is clean; generated `dist/`, `release-artifacts/`, and `SunoLyricDownloader.zip` remain untracked or ignored as intended.

- [ ] **Step 2: Inspect the store ZIP**

```bash
unzip -Z1 SunoLyricDownloader.zip | rg 'manifest.json|LICENSE.txt|NOTICE-HISTORICAL-SOURCE.md|THIRD_PARTY_NOTICES.md'
unzip -p SunoLyricDownloader.zip manifest.json | rg '"version": "3.0.0"'
```

Expected: all four required files are present and the packaged manifest is `3.0.0`.

- [ ] **Step 3: Recheck immutable public records**

```bash
git rev-parse 'v2.0.9^{commit}'
git rev-parse 'oss-source-cutoff^{commit}'
curl --fail --silent --show-error https://downloads.zhanghe.dev/get-suno-lyric/oss-source-cutoff.json
curl --fail --silent --show-error --head https://downloads.zhanghe.dev/get-suno-lyric/v2.0.9/get-suno-lyric-2.0.9-source.zip
gh repo view zh30/get-suno-lyric --json visibility -q .visibility
```

Expected: `v2.0.9` retains the approved SHA, cutoff Git/JSON SHAs agree, archive is public, and repository visibility is `PRIVATE`.

- [ ] **Step 4: Perform manual Chrome smoke tests**

Load `dist/` unpacked and verify:

1. LRC download still works.
2. SRT download still works.
3. Existing automatic timing repair still works.
4. Popup and content script load without console errors.
5. No Creator Pro UI, payment request, license request, or new permission is present yet.

- [ ] **Step 5: Stop before Chrome Web Store publication**

Do not upload `3.0.0` to Chrome Web Store. This boundary build contains no Creator Pro feature and is not a public release candidate. Report verification evidence and create the next independent implementation plan for the local 1080p video feasibility spike described in Section 9 of the approved design specification.

## Spec Coverage Self-Review

- Source transition and one-repository model: covered by Tasks 1–6.
- Immutable `v2.0.9` SHA and non-retroactivity: enforced by tests, provenance, and public notice.
- Stable public archive, MIT text, provenance, and SHA-256: covered by Tasks 1 and 4.
- Public `oss-source-cutoff` SHA: covered by Tasks 3 and 5.
- Minimum 14-day notice: enforced by annotated tag and elapsed-time gate in Tasks 4–5.
- Private repository and same Git history: covered by Task 5; no new repository is created.
- Proprietary `3.0.0`, `private`, `UNLICENSED`, reviewed EULA, historical notice, and third-party notices: covered by Task 6.
- Current free features and same extension ID: explicitly preserved; no manifest identity or permission changes are allowed.
- No Pro implementation or premature store release: enforced by Tasks 6 and 7.

## Required Follow-On Plans

After this plan is complete, create and approve separate implementation plans in this order:

1. Local 1080p horizontal/vertical video feasibility spike and device matrix.
2. Canonical lyric-project schema, persistence, migrations, and project-recovery guarantees.
3. Free QA report, Lyric Studio editing, and professional export presets.
4. Cloudflare License Worker, Lemon Squeezy webhook verification, signed entitlements, and two-installation lifecycle.
5. Local Video Studio templates, preview, render, cancellation, and recovery.
6. Closed beta, test-purchase activation, launch copy, support runbook, and Chrome Web Store release candidate.
