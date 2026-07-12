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
