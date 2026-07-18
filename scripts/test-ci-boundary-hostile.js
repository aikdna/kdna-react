#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHECKOUT_ACTION,
  SETUP_NODE_ACTION,
  EXPECTED_CI_WORKFLOW,
  assertCiBoundary,
  loadCandidate,
} from './check-ci-boundary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const valid = loadCandidate(root);
assertCiBoundary(valid);

function replaceOnce(value, expected, replacement) {
  assert.equal(value.split(expected).length - 1, 1, `fixture fragment count drifted: ${expected}`);
  return value.replace(expected, replacement);
}

function copy(overrides = {}) {
  return {
    workflow: overrides.workflow ?? valid.workflow,
    dcoWorkflow: overrides.dcoWorkflow ?? valid.dcoWorkflow,
    pkg: overrides.pkg ?? structuredClone(valid.pkg),
    lock: overrides.lock ?? structuredClone(valid.lock),
    allowlist: overrides.allowlist ?? structuredClone(valid.allowlist),
  };
}

const mutableSetup = ['actions/setup-node@', 'v', '6'].join('');
const workflowMutations = new Map([
  ['paths-ignore bypass', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '    branches: [main]\n  pull_request:',
    "    branches: [main]\n    paths-ignore:\n      - 'CHANGELOG.md'\n  pull_request:",
  )],
  ['job condition', replaceOnce(EXPECTED_CI_WORKFLOW, '  test:\n', '  test:\n    if: false\n')],
  ['step condition', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '      - run: npm run ci\n',
    '      - if: false\n        run: npm run ci\n',
  )],
  ['job permission override', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '  test:\n',
    '  test:\n    permissions:\n      contents: write\n',
  )],
  ['matrix exclusion', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    "        node: ['20.20.2', '22.23.1', '24.18.0', '26.5.0']\n",
    "        node: ['20.20.2', '22.23.1', '24.18.0', '26.5.0']\n        exclude:\n          - node: '20.20.2'\n",
  )],
  ['matrix inclusion', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    "        node: ['20.20.2', '22.23.1', '24.18.0', '26.5.0']\n",
    "        node: ['20.20.2', '22.23.1', '24.18.0', '26.5.0']\n        include:\n          - node: '28.0.0'\n",
  )],
  ['extra action', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    `      - uses: ${SETUP_NODE_ACTION}\n`,
    `      - uses: ${SETUP_NODE_ACTION}\n      - uses: ${SETUP_NODE_ACTION}\n`,
  )],
  ['mutable action', replaceOnce(EXPECTED_CI_WORKFLOW, SETUP_NODE_ACTION, mutableSetup)],
  ['continue on error', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '      - run: npm run ci\n',
    '      - run: npm run ci\n        continue-on-error: true\n',
  )],
  ['extra job', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    'jobs:\n',
    'jobs:\n  bypass:\n    runs-on: ubuntu-latest\n    steps: []\n',
  )],
  ['direct boundary removal', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '      - run: node scripts/check-ci-boundary.js\n',
    '',
  )],
  ['dependency lifecycle enabled', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '      - run: npm ci --ignore-scripts --no-audit --no-fund\n',
    '      - run: npm ci\n',
  )],
  ['asset commit floated', replaceOnce(
    EXPECTED_CI_WORKFLOW,
    '          ref: 2dd1e2844fd8b8deff8ea0e2620fd946e5c9544f\n',
    '          ref: main\n',
  )],
]);

let rejected = 0;
for (const [name, workflow] of workflowMutations) {
  assert.throws(() => assertCiBoundary(copy({ workflow })), undefined, name);
  rejected += 1;
}

const packageMutations = new Map();
const noRuntime = structuredClone(valid.pkg);
noRuntime.scripts.ci = noRuntime.scripts.ci.replace(' && npm run package:runtime-check', '');
packageMutations.set('packed runtime omitted', noRuntime);
const noHostile = structuredClone(valid.pkg);
noHostile.scripts['ci:boundary'] = 'node scripts/check-ci-boundary.js';
packageMutations.set('hostile gate omitted', noHostile);
const noIntegration = structuredClone(valid.pkg);
delete noIntegration.scripts['test:web-stack-integration'];
packageMutations.set('real integration omitted', noIntegration);
const rangedClient = structuredClone(valid.pkg);
rangedClient.dependencies['@aikdna/kdna-web-client'] = '^0.2.2';
packageMutations.set('Web Client range dependency', rangedClient);
const olderEngine = structuredClone(valid.pkg);
olderEngine.engines.node = '>=18';
packageMutations.set('engine floor weakened', olderEngine);
for (const [name, pkg] of packageMutations) {
  assert.throws(() => assertCiBoundary(copy({ pkg })), undefined, name);
  rejected += 1;
}

assert.throws(
  () => assertCiBoundary(copy({ dcoWorkflow: valid.dcoWorkflow.replace('name: DCO', 'name: DCO bypass') })),
  undefined,
  'DCO workflow drift',
);
rejected += 1;

const lock = structuredClone(valid.lock);
lock.packages['node_modules/@aikdna/kdna-web-client'].version = '0.2.1';
assert.throws(() => assertCiBoundary(copy({ lock })), undefined, 'lock drift');
rejected += 1;

const allowlist = structuredClone(valid.allowlist);
allowlist.exceptions.push({
  path: '.github/workflows/ci.yml',
  token: 'bypass',
  count: 1,
  reason: 'Third-party hostile fixture.',
});
assert.throws(() => assertCiBoundary(copy({ allowlist })), undefined, 'workflow allowlist bypass');
rejected += 1;

assert.equal(CHECKOUT_ACTION.includes('@'), true);
console.log(`CI boundary hostile mutations rejected: ${rejected}/${rejected}.`);
