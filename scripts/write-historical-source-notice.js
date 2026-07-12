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
