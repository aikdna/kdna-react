import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
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
  traceAnswerSummary,
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
    traceAnswerSummary,
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

test('public maintenance docs do not claim a web-client dependency boundary', () => {
  for (const relPath of ['../NOTICE', '../CONTRIBUTING.md', '../SECURITY.md']) {
    const text = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /builds on @aikdna\/kdna-web-client/);
    assert.doesNotMatch(text, /wrappers over `@aikdna\/kdna-web-client`/);
    assert.doesNotMatch(text, /wraps web-client\/server adapter state/);
    assert.doesNotMatch(text, /asset creation/);
  }
});

// ── Trace 0.9 helpers ────────────────────────────────────────────
test('parseTrace accepts 0.9 trace_version', () => {
  const t = parseTrace(JSON.stringify({
    trace_version: '0.9.0',
    trace_id: 'trace_abc123abc123abc1',
    plan_id: 'plan_abc123',
    mode: 'single',
    timestamp: '2026-07-13T00:00:00Z',
    asset_identity: { asset_id: '@test/asset' },
    execution: { status: 'blocked' },
  }));
  assert.strictEqual(t.trace_version, '0.9.0');
  assert.strictEqual(t.trace_id, 'trace_abc123abc123abc1');
});

test('parseTrace rejects incomplete current traces', () => {
  assert.throws(
    () => parseTrace(JSON.stringify({ trace_version: '0.9.0', trace_id: 'trace_abc123abc123abc1' })),
    /Invalid JudgmentTrace/,
  );
});

test('validateTrace rejects missing version', () => {
  const r = validateTrace({ trace_id: 'abc' });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.length > 0);
});

test('validateTrace accepts valid 0.9 trace', () => {
  const r = validateTrace({
    trace_version: '0.9.0',
    trace_id: 'abc123abc123abc123abc123',
    plan_id: 'plan_abc123',
    mode: 'single',
    timestamp: '2026-07-13T00:00:00Z',
    asset_identity: { asset_id: '@test/asset' },
    execution: { status: 'blocked' },
  });
  assert.strictEqual(r.valid, true);
});

test('tracePrimaryLabel resolves from asset_identity', () => {
  const label = tracePrimaryLabel({ asset_identity: { asset_id: '@test/primary' } });
  assert.strictEqual(label, '@test/primary');
});

test('tracePrimaryLabel resolves from assets_loaded (cluster)', () => {
  const label = tracePrimaryLabel({ assets_loaded: [{ asset_id: '@test/p1', role: 'primary' }, { asset_id: '@test/a1', role: 'advisor' }] });
  assert.strictEqual(label, '@test/p1');
});

test('traceIsOverBudget detects over-budget', () => {
  assert.strictEqual(traceIsOverBudget({ cost: { over_budget: true } }), true);
  assert.strictEqual(traceIsOverBudget({}), false);
});

test('traceAnswerSummary returns answer summary', () => {
  assert.strictEqual(traceAnswerSummary({ result_ref: { answer_summary: 'Proceed' } }), 'Proceed');
  assert.strictEqual(traceAnswerSummary({}), '');
});

test('parseTrace rejects unknown version', () => {
  assert.throws(() => parseTrace(JSON.stringify({ trace_version: '99.0.0', trace_id: 'abc' })), /Unknown trace version/);
});

test('validateTrace rejects unknown execution status', () => {
  const r = validateTrace({ trace_version: '0.9.0', trace_id: 'abc123abc123abc123abc123', plan_id: 'plan_abc123', execution: { status: 'invented_success' } });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('invented_success')));
});

test('parseTrace rejects stale alternate trace shapes', () => {
  assert.throws(
    () => parseTrace(JSON.stringify({ kdna_trace: '1.0.0', trace_id: 'abc123abc123abc123abc123abc123ab' })),
    /missing trace_version/,
  );
});

test('KDNATraceViewer renders a 0.9 trace', () => {
  const trace = {
    trace_version: '0.9.0',
    trace_id: 'trace_abc123abc123abc1',
    plan_id: 'plan_abc123',
    mode: 'single',
    asset_identity: { asset_id: '@test/asset', version: '0.1.0', digest: 'sha256:aaaa' },
    execution: { status: 'completed', model: 'test-model' },
    result_ref: { answer_summary: 'Test result.' },
    cost: { over_budget: false },
    warnings: [],
  };
  const html = renderToStaticMarkup(React.createElement(KDNATraceViewer, { trace, visible: true }));
  assert.match(html, /trace_abc123abc123abc1/);
  assert.match(html, /@test\/asset/);
  assert.match(html, /Test result/);
  assert.match(html, /completed/);
});

// ── useTrace ──────────────────────────────────────────────────────
test('useTrace extracts primary from 0.9 single trace', () => {
  const result = useTrace({
    trace_version: '0.9.0', trace_id: 'trace_test123456789012', plan_id: 'plan_test',
    mode: 'single',
    asset_identity: { asset_id: '@test/primary', version: '0.1.0', digest: 'sha256:aaaa', digest_verified: true },
    execution: { status: 'completed' },
    result_ref: { answer_summary: 'Proceed.', result_stored: true },
    cost: { tokens_used: 100, over_budget: false },
    warnings: [],
    errors: [],
  });
  assert.strictEqual(result.primary, '@test/primary');
  assert.strictEqual(result.mode, 'single');
  assert.strictEqual(result.confidence, 'unknown');
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.answerSummary, 'Proceed.');
  assert.strictEqual(result.hasResult, true);
  assert.strictEqual(result.advisors.length, 0);
});

test('useTrace extracts cluster fields', () => {
  const result = useTrace({
    trace_version: '0.9.0', trace_id: 'trace_cluster1234567890', plan_id: 'plan_cluster',
    mode: 'cluster',
    assets_loaded: [
      { asset_id: '@test/primary', role: 'primary', weight: 1.0, digest_verified: true },
      { asset_id: '@test/advisor', role: 'advisor', weight: 0.6, contribution_hypothesis: 'API design review', contribution_fulfilled: true, digest_verified: true },
    ],
    selection_actual: { primary: '@test/primary', advisors: ['@test/advisor'] },
    execution: { status: 'completed' },
    cost: { tokens_used: 500, over_budget: false },
    source_attribution: [{ asset_id: '@test/primary', axioms_triggered: 2, transfer_depth: { operationalized: 2, referenced: 0, mentioned: 0 } }],
    warnings: ['Budget close to limit'],
  });
  assert.strictEqual(result.isCluster, true);
  assert.strictEqual(result.primary, '@test/primary');
  assert.strictEqual(result.advisors.length, 1);
  assert.strictEqual(result.advisors[0].asset_id, '@test/advisor');
  assert.strictEqual(result.advisors[0].contribution_fulfilled, true);
  assert.strictEqual(result.attribution.length, 1);
  assert.strictEqual(result.attribution[0].operationalized, 2);
  assert.strictEqual(result.hasIssues, true);
  assert.strictEqual(result.warnings.length, 1);
});
