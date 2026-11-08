const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const testDir = path.resolve(__dirname, '../dist/test');
if (!fs.existsSync(testDir)) {
  console.error(`Test directory not found: ${testDir}`);
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(testDir, f));

if (testFiles.length === 0) {
  console.error('No test files found in dist/test');
  process.exit(1);
}

const result = cp.spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
