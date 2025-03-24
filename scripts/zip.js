const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 创建输出流
const output = fs.createWriteStream(path.join(__dirname, '../SunoLyricDownloader.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // 设置压缩级别
});

output.on('close', () => {
  console.log('Archive created successfully');
  console.log(`Total bytes: ${archive.pointer()}`);
});

archive.on('error', (err) => {
  throw err;
});

// 将输出流 pipe 到 archive
archive.pipe(output);

// 添加 dist 目录下的所有文件
archive.directory('dist/', false);

// 完成归档
archive.finalize(); 