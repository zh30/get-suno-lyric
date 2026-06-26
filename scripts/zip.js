const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const ZIP_PATH = path.join(__dirname, '../SunoLyricDownloader.zip');
const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00Z');

function listDistFiles(directory, root = directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listDistFiles(absolutePath, root);
      }
      if (!entry.isFile()) {
        return [];
      }
      return [{
        absolutePath,
        archiveName: path.relative(root, absolutePath).split(path.sep).join('/')
      }];
    });
}

async function main() {
  const { ZipArchive } = await import('archiver');

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory does not exist. Run pnpm build before packaging.');
  }

  // 创建输出流
  const output = fs.createWriteStream(ZIP_PATH);
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

  // 添加 dist 目录下的所有文件。排序和固定时间戳让相同产物生成稳定 ZIP。
  listDistFiles(DIST_DIR).forEach(({ absolutePath, archiveName }) => {
    archive.file(absolutePath, {
      name: archiveName,
      date: ZIP_ENTRY_DATE
    });
  });

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
