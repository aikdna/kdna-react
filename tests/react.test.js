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
      defaultProfile: 'compact',
      loadPlan: { state: 'needs_password', required_action: 'enter_password' },
      profiles: ['index', 'compact'],
    },
  }));

  assert.match(html, /asset-card/);
  assert.match(html, /React Asset/);
  assert.match(html, /Domain: kdna:test:react/);
  assert.match(html, /0.1.0/);
  assert.match(html, /Encrypted/);
  assert.match(html, /Load plan: needs_password/);
  assert.match(html, /enter_password/);
  assert.match(html, /Default profile: compact/);
  assert.match(html, /compact/);
});

test('KDNAAssetInspector respects profile and load-plan visibility flags', () => {
  const html = renderToStaticMarkup(React.createElement(KDNAAssetInspector, {
    showProfiles: false,
    showLoadPlan: false,
    inspect: {
      domain: 'kdna:test:react',
      profiles: ['compact'],
      loadPlan: { state: 'ready', required_action: 'load' },
    },
  }));

  assert.doesNotMatch(html, /compact/);
  assert.doesNotMatch(html, /Load plan:/);
});

test('KDNAFileDropzone renders documented className, disabled state, and input label', () => {
  let state;
  const html = renderToStaticMarkup(React.createElement(KDNAFileDropzone, {
    endpoint: '/api/kdna',
    className: 'dropzone',
    disabled: true,
    label: 'Upload KDNA',
  }, (value) => {
    state = value;
    return React.createElement('button', { type: 'button', onClick: value.reset }, 'Reset');
  }));

  assert.match(html, /class="dropzone"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /aria-label="Upload KDNA"/);
  assert.match(html, /disabled=""/);
  assert.equal(state.identity, undefined);
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
  assert.match(license, /type="password"/);
});

test('KDNALicenseActivationForm posts canonical activation fields', () => {
  const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(source, /license_key: licenseKey/u);
  assert.match(source, /machine_fingerprint: machineFingerprint/u);
  assert.doesNotMatch(source, /licenseKey\s*\}\)/u);
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
    react: '>=18 <20',
    'react-dom': '>=18 <20',
  });
  assert.equal(pkg.peerDependenciesMeta, undefined);
  assert.deepEqual(pkg.dependencies, {
    '@aikdna/kdna-web-client': '0.2.2',
  });
});

test('public docs bind React networking to Web Client and render object content safely', () => {
  const paths = [
    '../README.md',
    '../CONTRIBUTING.md',
    '../SECURITY.md',
    '../docs/getting-started.md',
    '../docs/components/KDNALicenseActivationForm.md',
    '../docs/components/KDNALoadPlanGate.md',
    '../docs/hooks/useKDNA.md',
  ];
  const combined = paths.map((relPath) => (
    fs.readFileSync(new URL(relPath, import.meta.url), 'utf8')
  )).join('\n');
  assert.match(combined, /@aikdna\/kdna-web-client/);
  assert.match(combined, /0\.2\.2/u);
  assert.doesNotMatch(combined, /<pre>\{content\}<\/pre>/u);
  assert.doesNotMatch(combined, /content` \| `string/u);
  assert.doesNotMatch(combined, /browser never holds a key/u);
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

test('KDNATraceViewer does not render arbitrary schema-valid warning text', () => {
  const trace = structuredClone(fixture);
  trace.warnings = ['synthetic-protected-payload-value'];
  const html = renderToStaticMarkup(React.createElement(KDNATraceViewer, { trace, visible: true }));
  assert.match(html, /1 warning item hidden/u);
  assert.doesNotMatch(html, /synthetic-protected-payload-value/u);
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
