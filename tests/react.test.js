import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KDNA_SCHEMA_AUTHORITY,
  KDNAAssetInspector,
  KDNAFileDropzone,
  KDNALicenseActivationForm,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  KDNATraceViewer,
  useKDNA,
  useKDNALoadPlan,
  useTrace,
  parseTrace,
  validateTrace,
  tracePrimaryLabel,
  traceIsOverBudget,
  traceResultDigest,
} from '../src/index.js';

const CHECKOUT_ACTION = 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const SETUP_NODE_ACTION = 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38';
const TESTED_NODE_RELEASES = Object.freeze(['18', '20', '22']);
const EXPECTED_PACKAGE_GATE = Object.freeze([
  'npm run validators:check',
  'npm test',
  'npm run typecheck',
  'npm run lint',
  'npm run build',
  'npm run size',
  'npm run naming:check',
  'npm run package:runtime-check',
  'npm pack --dry-run --json',
]);
const EXPECTED_CI_WORKFLOW = [
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
  `      - uses: ${SETUP_NODE_ACTION}`,
  '        with:',
  '          node-version: ${{ matrix.node }}',
  '      - run: npm ci',
  '      - run: npm run ci',
  '',
].join('\n');

function assertCiWorkflowContract(workflow, pkg) {
  assert.equal(workflow, EXPECTED_CI_WORKFLOW);
  assert.equal(pkg.engines.node, '>=18');
  assert.deepEqual(pkg.scripts.ci.split(/\s*&&\s*/u), EXPECTED_PACKAGE_GATE);
}

function replaceWorkflowFragment(workflow, expected, replacement) {
  assert.equal(workflow.split(expected).length - 1, 1);
  return workflow.replace(expected, replacement);
}

test('exports expected components and hooks', () => {
  for (const value of [
    KDNAAssetInspector,
    KDNAFileDropzone,
    KDNALicenseActivationForm,
    KDNALoadPlanGate,
    KDNAPasswordUnlockDialog,
    KDNATraceViewer,
    useKDNA,
    useKDNALoadPlan,
    useTrace,
    parseTrace,
    validateTrace,
    tracePrimaryLabel,
    traceIsOverBudget,
    traceResultDigest,
  ]) {
    assert.equal(typeof value, 'function');
  }
});

test('KDNAAssetInspector renders stable public metadata', () => {
  const html = renderToStaticMarkup(React.createElement(KDNAAssetInspector, {
    className: 'asset-card',
    inspect: {
      domain: 'kdna:test:react',
      title: 'React Asset',
      version: '0.1.0',
      description: 'Renderable metadata',
      encrypted: true,
      loadPlan: { mode: 'password', requirements: ['password'] },
      profiles: ['index', 'compact'],
    },
  }));

  assert.match(html, /asset-card/);
  assert.match(html, /React Asset/);
  assert.match(html, /0.1.0/);
  assert.match(html, /Encrypted/);
  assert.match(html, /Load plan: password/);
  assert.match(html, /compact/);
});

test('KDNAAssetInspector respects profile and load-plan visibility flags', () => {
  const html = renderToStaticMarkup(React.createElement(KDNAAssetInspector, {
    showProfiles: false,
    showLoadPlan: false,
    inspect: {
      domain: 'kdna:test:react',
      profiles: ['compact'],
      loadPlan: { mode: 'open' },
    },
  }));

  assert.doesNotMatch(html, /compact/);
  assert.doesNotMatch(html, /Load plan:/);
});

test('KDNAFileDropzone renders documented className, disabled state, and input label', () => {
  const html = renderToStaticMarkup(React.createElement(KDNAFileDropzone, {
    endpoint: '/api/kdna',
    className: 'dropzone',
    disabled: true,
    label: 'Upload KDNA',
  }, ({ reset }) => React.createElement('button', { type: 'button', onClick: reset }, 'Reset')));

  assert.match(html, /class="dropzone"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /aria-label="Upload KDNA"/);
  assert.match(html, /disabled=""/);
});

test('form components render without browser-only globals during SSR', () => {
  const password = renderToStaticMarkup(React.createElement(KDNAPasswordUnlockDialog, {
    fileId: 'file-1',
    endpoint: '/api/kdna',
    hint: 'Ask the asset owner for this password.',
  }));
  assert.match(password, /type="password"/);
  assert.match(password, /Unlock asset/);
  assert.match(password, /Ask the asset owner/);

  const license = renderToStaticMarkup(React.createElement(KDNALicenseActivationForm, {
    domain: 'kdna:test:react',
    endpoint: '/api/kdna',
    label: 'Entitlement code',
    submitLabel: 'Redeem',
  }));
  assert.match(license, /Entitlement code/);
  assert.match(license, /Redeem/);
});

test('KDNALicenseActivationForm posts canonical activation fields', () => {
  const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(source, /JSON\.stringify\(\{ domain, license_key: licenseKey \}\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ domain, licenseKey \}\)/);
});

test('MVP public API does not expose placeholder creator components', () => {
  const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /KDNACreatorWizard/);
  assert.doesNotMatch(readme, /KDNACreatorWizard/);
  assert.doesNotMatch(readme, /placeholder/);
});

test('MVP public API does not expose server export helpers before export ships', () => {
  const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /KDNAExportButton/);
  assert.doesNotMatch(source, /['"]export['"]/);
  assert.doesNotMatch(readme, /KDNAExportButton/);
  assert.doesNotMatch(readme, /\/export/);
});

test('package peers only include React runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.deepEqual(pkg.peerDependencies, {
    react: '>=18',
    'react-dom': '>=18',
  });
  assert.equal(pkg.peerDependenciesMeta, undefined);
});

test('GitHub CI preserves the complete package gate on its declared Node matrix', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const allowlist = JSON.parse(fs.readFileSync(
    new URL('../scripts/naming-integrity-allowlist.json', import.meta.url),
    'utf8',
  ));

  assertCiWorkflowContract(workflow, pkg);
  assert.equal(allowlist.exceptions.length, 3);
  assert.ok(allowlist.exceptions.every((entry) => entry.path !== '.github/workflows/ci.yml'));
});

test('GitHub CI contract rejects workflow bypasses', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const mutableCheckout = ['actions/checkout@', 'v', '7'].join('');
  const mutations = new Map([
    ['job condition', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      '  test:\n',
      '  test:\n    if: false\n',
    )],
    ['step condition', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      '      - run: npm run ci\n',
      '      - if: false\n        run: npm run ci\n',
    )],
    ['job permission override', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      '  test:\n',
      '  test:\n    permissions:\n      contents: write\n',
    )],
    ['matrix exclusion', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      "        node: ['18', '20', '22']\n",
      "        node: ['18', '20', '22']\n        exclude:\n          - node: '18'\n",
    )],
    ['matrix inclusion', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      "        node: ['18', '20', '22']\n",
      "        node: ['18', '20', '22']\n        include:\n          - node: '24'\n",
    )],
    ['extra action', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      `      - uses: ${CHECKOUT_ACTION}\n`,
      `      - uses: ${CHECKOUT_ACTION}\n      - uses: ${CHECKOUT_ACTION}\n`,
    )],
    ['mutable action', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      CHECKOUT_ACTION,
      mutableCheckout,
    )],
    ['continue on error', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      '      - run: npm run ci\n',
      '      - run: npm run ci\n        continue-on-error: true\n',
    )],
    ['shell override', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      '      - run: npm run ci\n',
      '      - run: npm run ci\n        shell: bash\n',
    )],
    ['extra job', replaceWorkflowFragment(
      EXPECTED_CI_WORKFLOW,
      'jobs:\n',
      'jobs:\n  bypass:\n    runs-on: ubuntu-latest\n    steps: []\n',
    )],
  ]);

  for (const [name, workflow] of mutations) {
    assert.throws(
      () => assertCiWorkflowContract(workflow, pkg),
      (error) => error?.code === 'ERR_ASSERTION',
      name,
    );
  }
});

test('public maintenance docs do not claim a web-client dependency boundary', () => {
  for (const relPath of ['../NOTICE', '../CONTRIBUTING.md', '../SECURITY.md']) {
    const text = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /builds on @aikdna\/kdna-web-client/);
    assert.doesNotMatch(text, /wrappers over `@aikdna\/kdna-web-client`/);
    assert.doesNotMatch(text, /wraps web-client\/server adapter state/);
    assert.doesNotMatch(text, /asset creation/);
  }
});

const golden = JSON.parse(fs.readFileSync(
  new URL('../vendor/core-1e77e3e/runtime-contract-golden.json', import.meta.url),
  'utf8',
));
const fixture = golden.trace;

function hostileTraces() {
  const cases = [];
  const add = (name, mutate) => {
    const trace = structuredClone(fixture);
    mutate(trace);
    cases.push([name, trace]);
  };
  add('empty host capabilities', (trace) => { trace.runtime_contract.host_capabilities = {}; });
  add('forged receipt', (trace) => { trace.host_receipt.runtime_receipt.forged = true; });
  add('illegal digest comparison', (trace) => {
    trace.digest_evidence.asset.comparison = {
      state: 'matched', against: null, expected: null, source: null,
    };
  });
  add('negative budget and malformed error', (trace) => {
    trace.budget.actual.tokens_used = -1;
    trace.errors = [{}];
  });
  add('inconsistent negotiation', (trace) => {
    trace.runtime_contract.selected_capsule_version = null;
  });
  return cases;
}

test('parseTrace accepts the sole current JudgmentTrace contract', () => {
  const trace = parseTrace(JSON.stringify(fixture));
  assert.equal(trace.type, 'kdna.judgment-trace');
  assert.equal(trace.contract_version, '0.1.0');
});

test('parseTrace rejects incomplete and retired trace shapes', () => {
  assert.throws(() => parseTrace(JSON.stringify({ type: 'kdna.judgment-trace' })), /Invalid JudgmentTrace/);
  const wrong = structuredClone(fixture);
  delete wrong.contract_version;
  wrong.mode = 'cluster';
  assert.throws(() => parseTrace(JSON.stringify(wrong)), /Invalid JudgmentTrace/);
  assert.throws(() => useTrace(wrong), /Invalid JudgmentTrace/);
  assert.throws(
    () => renderToStaticMarkup(React.createElement(KDNATraceViewer, { trace: wrong, visible: true })),
    /Invalid JudgmentTrace/,
  );
});

test('all public trace boundaries reject hostile nested mutations', () => {
  for (const [name, trace] of hostileTraces()) {
    assert.equal(validateTrace(trace).valid, false, name);
    assert.throws(() => parseTrace(JSON.stringify(trace)), /Invalid JudgmentTrace/, name);
    assert.throws(() => useTrace(trace), /Invalid JudgmentTrace/, name);
    assert.throws(() => tracePrimaryLabel(trace), /Invalid JudgmentTrace/, name);
    assert.throws(() => traceIsOverBudget(trace), /Invalid JudgmentTrace/, name);
    assert.throws(() => traceResultDigest(trace), /Invalid JudgmentTrace/, name);
    assert.throws(
      () => renderToStaticMarkup(React.createElement(KDNATraceViewer, { trace, visible: true })),
      /Invalid JudgmentTrace/,
      name,
    );
  }
});

test('validator authority is pinned to the audited Core schema closure', () => {
  assert.deepEqual(KDNA_SCHEMA_AUTHORITY, {
    core_commit: '1e77e3e0d486c330fe9f9262b514ef24c859d469',
    aggregate_sha256: '8c38138e18ac5b465d779aeaf9fadcdd846236b0f96e7b144a6cc5c228ad480d',
    judgment_trace_sha256: 'a260e5abbcc68bf8df11ba738b5d475901b2950668c4718e415355adc723c7b0',
  });
});

test('validateTrace rejects unknown execution status and observation claims', () => {
  const status = structuredClone(fixture);
  status.execution.execution_status = 'invented_success';
  assert.equal(validateTrace(status).valid, false);

  const consumption = structuredClone(fixture);
  consumption.execution.semantic_consumption = { state: 'consumed', basis: 'inferred' };
  assert.equal(validateTrace(consumption).valid, false);
});

test('trace helpers expose evidence, not an invented answer', () => {
  assert.equal(tracePrimaryLabel(fixture), 'kdna:example:agent-project-context');
  assert.equal(traceIsOverBudget(fixture), false);
  assert.equal(traceResultDigest(fixture), fixture.result_ref.result_digest);
});

test('KDNATraceViewer keeps delivery, execution, consumption, and conformance distinct', () => {
  const html = renderToStaticMarkup(React.createElement(KDNATraceViewer, { trace: fixture, visible: true }));
  assert.ok(html.includes(`<h3>JudgmentTrace: ${fixture.trace_id}</h3>`));
  assert.match(html, /Delivery: correlated_response/);
  assert.match(html, /Execution: completed/);
  assert.match(html, /Semantic consumption: not_observed/);
  assert.match(html, /Conformance: not_evaluated/);
  assert.doesNotMatch(html, /The fixture demonstrates/);
});

test('useTrace preserves unobserved usage instead of coercing it to zero', () => {
  const view = useTrace(fixture);
  assert.equal(view.primary, 'kdna:example:agent-project-context');
  assert.equal(view.status, 'execution_completed');
  assert.equal(view.tokensUsed, null);
  assert.equal(view.usageBasis, 'not_observed');
  assert.equal(view.semanticConsumption, 'not_observed');
  assert.equal(view.conformanceStatus, 'not_evaluated');
  assert.equal(view.resultDigest, fixture.result_ref.result_digest);
});
