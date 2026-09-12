const { spawnSync } = require('node:child_process');
const compiler = process.env.KDNA_TSC_JS || require.resolve('typescript/lib/tsc.js');
const result = spawnSync(process.execPath, [compiler, '--project', 'tsconfig.json'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
