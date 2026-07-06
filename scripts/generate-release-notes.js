#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');

const DEFAULT_REPO = 'zh30/get-suno-lyric';
const DEFAULT_ASSET_NAME = 'SunoLyricDownloader.zip';
const DEFAULT_CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/suno-lyric-downloader/hhplbhnaldbldkgfkcfjklfneggokijm';
const DEFAULT_OUTPUT_PATH = 'RELEASE_NOTES.md';

const GROUP_ORDER = [
  'New',
  'Fixes',
  'Improvements',
  'Documentation',
  'Maintenance',
  'Other'
];

const TYPE_GROUPS = {
  feat: 'New',
  fix: 'Fixes',
  perf: 'Improvements',
  refactor: 'Improvements',
  docs: 'Documentation',
  build: 'Maintenance',
  chore: 'Maintenance',
  ci: 'Maintenance',
  deps: 'Maintenance',
  test: 'Maintenance'
};

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = inlineValue ?? argv[index + 1];
    args[key] = value;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return args;
}

function runGit(args, options = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe']
    }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return '';
    }
    throw error;
  }
}

function parseCommitSubject(subject) {
  const trimmed = subject.trim();
  const match = trimmed.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/i);

  if (!match) {
    return {
      type: 'other',
      scope: undefined,
      breaking: false,
      description: trimmed
    };
  }

  return {
    type: match[1].toLowerCase(),
    scope: match[2],
    breaking: Boolean(match[3]),
    description: match[4].trim()
  };
}

function sentenceCase(text) {
  const trimmed = text.trim().replace(/[.。]+$/, '');
  if (!trimmed) {
    return '';
  }

  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}

function inferPlainCommitGroup(description) {
  const normalized = description.trim().toLowerCase();

  if (/^(add|create|enable|introduce|support)\b/.test(normalized)) {
    return 'New';
  }
  if (/^(fix|handle|prevent|repair|restore)\b/.test(normalized)) {
    return 'Fixes';
  }
  if (/^(doc|docs|readme)\b/.test(normalized)) {
    return 'Documentation';
  }
  if (/\b(build|ci|dependency|dependencies|deps|packaging|release|workflow)\b/.test(normalized)) {
    return 'Maintenance';
  }
  if (/^(enhance|extract|improve|merge|optimize|redesign|refine|simplify|strip|update)\b/.test(normalized)) {
    return 'Improvements';
  }

  return 'Other';
}

function categorizeCommitSubject(subject) {
  const parsed = parseCommitSubject(subject);
  const group = parsed.breaking
    ? 'New'
    : TYPE_GROUPS[parsed.type] ?? inferPlainCommitGroup(parsed.description);

  return {
    ...parsed,
    group,
    title: sentenceCase(parsed.description)
  };
}

function uniqueChanges(commits) {
  const seen = new Set();
  return commits
    .map((subject) => categorizeCommitSubject(subject))
    .filter((change) => {
      if (!change.title || /^merge (pull request|branch)\b/i.test(change.title)) {
        return false;
      }
      const key = `${change.group}:${change.title.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function buildCompareUrl(repo, previousTag, currentTag) {
  if (previousTag) {
    return `https://github.com/${repo}/compare/${previousTag}...${currentTag}`;
  }

  return `https://github.com/${repo}/releases/tag/${currentTag}`;
}

function buildHighlights(changes) {
  const highlightGroups = new Set(['New', 'Fixes', 'Improvements']);
  const highlights = changes
    .filter((change) => highlightGroups.has(change.group))
    .slice(0, 4)
    .map((change) => `- ${change.title}`);

  if (highlights.length > 0) {
    return highlights;
  }

  return ['- Maintenance release with packaging and dependency updates.'];
}

function buildGroupedChanges(changes) {
  if (changes.length === 0) {
    return [
      '### Maintenance',
      '',
      '- Packaging and release automation updates.'
    ].join('\n');
  }

  return GROUP_ORDER
    .map((group) => {
      const groupChanges = changes.filter((change) => change.group === group);
      if (groupChanges.length === 0) {
        return '';
      }

      const bullets = groupChanges.map((change) => `- ${change.title}`).join('\n');
      return `### ${group}\n\n${bullets}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildReleaseNotes(options) {
  const {
    version,
    repo = DEFAULT_REPO,
    previousTag,
    currentTag = `v${version}`,
    assetName = DEFAULT_ASSET_NAME,
    chromeWebStoreUrl = DEFAULT_CHROME_WEB_STORE_URL,
    commits = []
  } = options;

  if (!version) {
    throw new Error('version is required');
  }

  const changes = uniqueChanges(commits);
  const compareUrl = buildCompareUrl(repo, previousTag, currentTag);
  const rangeLabel = previousTag ? `${previousTag}...${currentTag}` : currentTag;
  const chromeWebStoreLine = chromeWebStoreUrl
    ? `- Chrome Web Store: [Suno Lyric Downloader](${chromeWebStoreUrl})`
    : '- Chrome Web Store: update from the extension listing when available.';

  return [
    `# Suno Lyric Downloader v${version}`,
    '',
    'A focused update for cleaner, more reliable synchronized lyric downloads from Suno.',
    '',
    '## Highlights',
    '',
    buildHighlights(changes).join('\n'),
    '',
    "## What's Changed",
    '',
    buildGroupedChanges(changes),
    '',
    '## Download',
    '',
    chromeWebStoreLine,
    `- Manual install: download \`${assetName}\` from this release, unzip it, then load the folder from \`chrome://extensions\`.`,
    '',
    '## Release Details',
    '',
    `- Version: \`${version}\``,
    `- Artifact: \`${assetName}\``,
    `- Commit range: \`${rangeLabel}\``,
    '',
    '## Full Changelog',
    '',
    `[Compare changes](${compareUrl})`,
    ''
  ].join('\n');
}

function getCurrentTag(args, env) {
  if (args.currentTag) {
    return args.currentTag;
  }
  if (env.GITHUB_REF_NAME) {
    return env.GITHUB_REF_NAME;
  }
  if (env.GITHUB_REF?.startsWith('refs/tags/')) {
    return env.GITHUB_REF.slice('refs/tags/'.length);
  }

  return runGit(['describe', '--tags', '--exact-match'], { allowFailure: true });
}

function getVersion(args, env, currentTag) {
  if (args.version) {
    return args.version;
  }
  if (env.VERSION) {
    return env.VERSION;
  }
  if (currentTag?.startsWith('v')) {
    return currentTag.slice(1);
  }

  return currentTag;
}

function getPreviousTag(args, currentTag) {
  if (args.previousTag) {
    return args.previousTag;
  }
  if (!currentTag) {
    return undefined;
  }

  return runGit(['describe', '--tags', '--abbrev=0', `${currentTag}^`], { allowFailure: true }) || undefined;
}

function getCommitSubjects(previousTag, currentTag) {
  const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
  if (!range) {
    return [];
  }

  const output = runGit(['log', '--pretty=format:%s', range], { allowFailure: true });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentTag = getCurrentTag(args, process.env);
  const version = getVersion(args, process.env, currentTag);

  if (!version || !currentTag) {
    throw new Error('Could not determine release version or current tag.');
  }

  const previousTag = getPreviousTag(args, currentTag);
  const repo = args.repo || process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const assetName = args.assetName || process.env.RELEASE_ASSET_NAME || DEFAULT_ASSET_NAME;
  const chromeWebStoreUrl = args.chromeWebStoreUrl || process.env.CHROME_WEB_STORE_URL || DEFAULT_CHROME_WEB_STORE_URL;
  const outputPath = args.output || process.env.RELEASE_NOTES_PATH || DEFAULT_OUTPUT_PATH;
  const commits = getCommitSubjects(previousTag, currentTag);

  const notes = buildReleaseNotes({
    version,
    repo,
    previousTag,
    currentTag,
    assetName,
    chromeWebStoreUrl,
    commits
  });

  fs.writeFileSync(outputPath, notes);
  console.log(`Release notes written to ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReleaseNotes,
  categorizeCommitSubject,
  parseCommitSubject
};
