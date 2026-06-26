const fs = require('fs');
const path = require('path');

async function main() {
  const { ZipArchive } = await import('archiver');

  // 创建输出流
  const output = fs.createWriteStream(path.join(__dirname, '../SunoLyricDownloader.zip'));
  const archive = new ZipArchive({
    zlib: { level: 9 } // 设置压缩级别
  });

  const archiveClosed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  // 将输出流 pipe 到 archive
  archive.pipe(output);

  // 添加 dist 目录下的所有文件
  archive.directory('dist/', false);

  // 完成归档
  await archive.finalize();
  await archiveClosed;

  console.log('Archive created successfully');
  console.log(`Total bytes: ${archive.pointer()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
