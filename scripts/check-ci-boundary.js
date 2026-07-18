#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CHECKOUT_ACTION = 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
export const SETUP_NODE_ACTION = 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38';
export const EXPECTED_DCO_WORKFLOW_SHA256 =
  'ac61835686584f63f040ade1f298c04f9ac450e45ff4fd3c4c0744708a306a2b';
export const TESTED_NODE_RELEASES = Object.freeze([
  '20.20.2', '22.23.1', '24.18.0', '26.5.0',
]);
export const EXPECTED_PACKAGE_GATE = Object.freeze([
  'npm run ci:boundary',
  'npm run validators:check',
  'npm test',
  'npm run typecheck',
  'npm run lint',
  'npm run build',
  'npm run size',
  'npm run public:check',
  'npm run naming:check',
  'npm run package:runtime-check',
  'npm pack --dry-run --json',
]);
export const EXPECTED_BOUNDARY_GATE = [
  'node scripts/check-ci-boundary.js',
  'node scripts/test-ci-boundary-hostile.js',
].join(' && ');
export const EXPECTED_CI_WORKFLOW = [
  'name: CI',
  '',
  'on:',
  '  push:',
  '    branches: [main]',
  '  pull_request:',
  '    branches: [main]',
  '',
  'permissions:',
  '  contents: read',
  '',
  'jobs:',
  '  test:',
  '    runs-on: ubuntu-latest',
  '    timeout-minutes: 10',
  '    strategy:',
  '      fail-fast: true',
  '      matrix:',
  `        node: [${TESTED_NODE_RELEASES.map((release) => `'${release}'`).join(', ')}]`,
  '    steps:',
  `      - uses: ${CHECKOUT_ACTION}`,
  `      - uses: ${CHECKOUT_ACTION}`,
  '        with:',
  '          repository: aikdna/kdna-assets',
  '          ref: 2dd1e2844fd8b8deff8ea0e2620fd946e5c9544f',
  '          path: public-assets',
  `      - uses: ${SETUP_NODE_ACTION}`,
  '        with:',
  '          node-version: ${{ matrix.node }}',
  '          check-latest: false',
  '      - run: npm ci --ignore-scripts --no-audit --no-fund',
  '      - run: node scripts/check-ci-boundary.js',
  '      - run: npm run ci',
  '      - name: Exercise React, Web Client 0.2.2, Web Server 0.3.0, and Activation 0.2.0',
  '        env:',
  '          KDNA_REACT_ASSET: public-assets/references/public/laozi-wuwei/laozi-wuwei-0.1.1.kdna',
  '        run: npm run test:web-stack-integration',
  '',
].join('\n');

export function loadCandidate(root) {
  return {
    workflow: fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
    dcoWorkflow: fs.readFileSync(path.join(root, '.github/workflows/dco.yml'), 'utf8'),
    pkg: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')),
    lock: JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')),
    allowlist: JSON.parse(fs.readFileSync(
      path.join(root, 'scripts/naming-integrity-allowlist.json'),
      'utf8',
    )),
  };
}

export function assertCiBoundary({ workflow, dcoWorkflow, pkg, lock, allowlist }) {
  assert.equal(workflow, EXPECTED_CI_WORKFLOW, 'CI workflow is not the exact reviewed contract');
  assert.equal(
    crypto.createHash('sha256').update(dcoWorkflow).digest('hex'),
    EXPECTED_DCO_WORKFLOW_SHA256,
    'DCO workflow is not the exact reviewed contract',
  );
  assert.equal(pkg.engines?.node, '>=20', 'Node engine floor drifted');
  assert.deepEqual(
    pkg.scripts?.ci?.split(/\s*&&\s*/u),
    EXPECTED_PACKAGE_GATE,
    'package CI gate drifted',
  );
  assert.equal(pkg.scripts?.['ci:boundary'], EXPECTED_BOUNDARY_GATE, 'boundary gate drifted');
  assert.equal(
    pkg.scripts?.['test:web-stack-integration'],
    'node --test tests/web-stack-integration.test.js',
    'real web-stack integration command drifted',
  );
  const exactDependencies = [
    ['dependencies', '@aikdna/kdna-web-client', '0.2.2'],
    ['devDependencies', '@aikdna/kdna-core', '0.20.0'],
    ['devDependencies', '@aikdna/kdna-web-server', '0.3.0'],
    ['devDependencies', '@aikdna/kdna-activation-server', '0.2.0'],
    ['devDependencies', '@types/react', '18.3.31'],
  ];
  for (const [group, name, version] of exactDependencies) {
    assert.equal(pkg[group]?.[name], version, `${name} package coordinate drifted`);
    assert.equal(lock.packages?.['']?.[group]?.[name], version, `${name} lock declaration drifted`);
    assert.equal(lock.packages?.[`node_modules/${name}`]?.version, version, `${name} lock resolution drifted`);
  }
  assert.equal(lock.version, pkg.version, 'lock root version drifted');
  assert.equal(lock.packages?.['']?.version, pkg.version, 'lock package version drifted');
  assert.equal(allowlist.schema, 'kdna.naming-integrity-third-party-allowlist');
  assert.equal(allowlist.schema_version, '0.1.0');
  assert.ok(Array.isArray(allowlist.exceptions));
  assert.ok(
    allowlist.exceptions.every((entry) => entry.path !== '.github/workflows/ci.yml'),
    'CI workflow must not be exempted from naming integrity',
  );
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  assertCiBoundary(loadCandidate(root));
  console.log('Exact React CI, package, lock, and allowlist boundary passed.');
}
