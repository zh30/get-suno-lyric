import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

function getStepBlock(stepName) {
  const lines = workflow.split('\n');
  const startIndex = lines.findIndex((line) => line.includes(`- name: ${stepName}`));
  assert.notEqual(startIndex, -1, `Expected step "${stepName}" to exist`);

  const endIndex = lines.findIndex((line, index) =>
    index > startIndex && /^      - name: /.test(line)
  );

  return lines.slice(startIndex, endIndex === -1 ? lines.length : endIndex).join('\n');
}

test('Chrome Web Store upload is skipped when publishing credentials are missing', () => {
  assert.match(workflow, /CHROME_EXTENSION_ID:\s+\$\{\{\s*secrets\.CHROME_EXTENSION_ID\s*\}\}/);
  assert.match(workflow, /CHROME_CLIENT_ID:\s+\$\{\{\s*secrets\.CHROME_CLIENT_ID\s*\}\}/);
  assert.match(workflow, /CHROME_CLIENT_SECRET:\s+\$\{\{\s*secrets\.CHROME_CLIENT_SECRET\s*\}\}/);
  assert.match(workflow, /CHROME_REFRESH_TOKEN:\s+\$\{\{\s*secrets\.CHROME_REFRESH_TOKEN\s*\}\}/);

  const uploadStep = getStepBlock('Upload to Chrome Web Store');

  assert.match(uploadStep, /if:\s+\$\{\{[\s\S]*env\.CHROME_EXTENSION_ID != ''[\s\S]*env\.CHROME_REFRESH_TOKEN != ''[\s\S]*\}\}/);
  assert.match(uploadStep, /extension-id:\s+\$\{\{\s*env\.CHROME_EXTENSION_ID\s*\}\}/);
  assert.match(uploadStep, /client-id:\s+\$\{\{\s*env\.CHROME_CLIENT_ID\s*\}\}/);
  assert.match(uploadStep, /client-secret:\s+\$\{\{\s*env\.CHROME_CLIENT_SECRET\s*\}\}/);
  assert.match(uploadStep, /refresh-token:\s+\$\{\{\s*env\.CHROME_REFRESH_TOKEN\s*\}\}/);
});

test('GitHub Release still runs independently of Chrome Web Store secrets', () => {
  const releaseStep = getStepBlock('Create GitHub Release');

  assert.doesNotMatch(releaseStep, /CHROME_/);
  assert.doesNotMatch(releaseStep, /^\s+if:/m);
  assert.match(releaseStep, /body_path:\s+RELEASE_NOTES\.md/);
});

test('workflow explains when Chrome Web Store upload is skipped', () => {
  const skippedStep = getStepBlock('Skip Chrome Web Store upload');

  assert.match(skippedStep, /if:\s+\$\{\{[\s\S]*env\.CHROME_EXTENSION_ID == ''[\s\S]*env\.CHROME_REFRESH_TOKEN == ''[\s\S]*\}\}/);
  assert.match(skippedStep, /Chrome Web Store upload skipped/);
});
