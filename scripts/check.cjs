const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const pkg = require('../package.json');
const api = require('..');
assert.deepEqual(Object.keys(api).sort(), ['KDNAFileInput','KDNAReadStatus','KDNAReadView','useKDNARead']);
assert.equal(pkg.version, '0.6.0-rc.component-semantics.1');
assert.equal(pkg.dependencies['@aikdna/kdna-web-client'], '0.5.0-rc.component-semantics.1');
assert.equal(Object.keys(pkg.dependencies).length, 1);
for (const file of ['src/index.cjs','src/index.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  assert.equal(result.status, 0);
}
const source = fs.readFileSync(path.join(__dirname,'../src/index.cjs'),'utf8');
assert(!/dangerouslySetInnerHTML|innerHTML|eval\(|new Function|node:|runtime-validators|\.\/generated/.test(source));
const dependencies = [...source.matchAll(/require\('([^']+)'\)/g)].map(m => m[1]);
assert.deepEqual(dependencies, ['react', '@aikdna/kdna-web-client']);
console.log(JSON.stringify({syntax:true,publicExports:Object.keys(api),runtimeImports:dependencies}));
