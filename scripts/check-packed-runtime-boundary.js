#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const report = JSON.parse(output)[0];
if (!report?.filename) throw new Error('npm pack did not report one package.');

const archive = path.join(root, report.filename);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kdna-react-runtime-pack-audit-'));
const expectedFiles = [
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
  'README.md',
  'SECURITY.md',
  'docs/components/KDNAAssetInspector.md',
  'docs/components/KDNAFileDropzone.md',
  'docs/components/KDNALicenseActivationForm.md',
  'docs/components/KDNALoadPlanGate.md',
  'docs/components/KDNAPasswordUnlockDialog.md',
  'docs/getting-started.md',
  'docs/hooks/useKDNA.md',
  'docs/hooks/useKDNALoadPlan.md',
  'package.json',
  'src/generated/runtime-validators.js',
  'src/index.d.ts',
  'src/index.js',
  'src/trace.ts',
];
const expectedRuntimeExports = [
  'KDNAActivationError',
  'KDNAAssetInspector',
  'KDNAFileDropzone',
  'KDNALicenseActivationForm',
  'KDNALoadPlanGate',
  'KDNAPasswordUnlockDialog',
  'KDNATraceViewer',
  'KDNA_SCHEMA_AUTHORITY',
  'parseTrace',
  'traceIsOverBudget',
  'tracePrimaryLabel',
  'traceResultDigest',
  'useKDNA',
  'useKDNALoadPlan',
  'useTrace',
  'validateTrace',
];

function hostileTraces(golden) {
  const cases = [];
  const add = (name, mutate) => {
    const trace = structuredClone(golden);
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

function mustThrow(operation, name, boundary) {
  try {
    operation();
  } catch {
    return;
  }
  throw new Error(`${boundary} accepted hostile packed trace: ${name}`);
}

try {
  const packedFiles = report.files.map(({ path: file }) => file).sort();
  if (JSON.stringify(packedFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Packed file surface drifted:\n${packedFiles.join('\n')}`);
  }

  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const directImplementations = entries.filter((entry) => /^package\/src\/useTrace\.[cm]?[jt]sx?$/u.test(entry));
  if (directImplementations.length !== 0) {
    throw new Error(`Obsolete direct useTrace implementation is shipped: ${directImplementations.join(', ')}`);
  }

  const implementationOwners = [];
  for (const entry of entries.filter((candidate) => /^package\/src\/.*\.[cm]?js$/u.test(candidate))) {
    const source = execFileSync('tar', ['-xOf', archive, entry], { encoding: 'utf8' });
    if (/export function useTrace\s*\(/u.test(source)) implementationOwners.push(entry);
  }
  if (implementationOwners.length !== 1 || implementationOwners[0] !== 'package/src/index.js') {
    throw new Error(`Packed package must have exactly one useTrace implementation in src/index.js; found ${implementationOwners.join(', ') || 'none'}.`);
  }

  execFileSync('tar', ['-xzf', archive, '-C', temp]);
  const packedManifest = JSON.parse(fs.readFileSync(path.join(temp, 'package/package.json'), 'utf8'));
  const exactCoordinates = {
    name: '@aikdna/kdna-react',
    version: '0.3.0',
    engine: '>=20',
    webClient: '0.2.2',
    reactPeer: '>=18 <20',
    reactDomPeer: '>=18 <20',
  };
  const actualCoordinates = {
    name: packedManifest.name,
    version: packedManifest.version,
    engine: packedManifest.engines?.node,
    webClient: packedManifest.dependencies?.['@aikdna/kdna-web-client'],
    reactPeer: packedManifest.peerDependencies?.react,
    reactDomPeer: packedManifest.peerDependencies?.['react-dom'],
  };
  if (JSON.stringify(actualCoordinates) !== JSON.stringify(exactCoordinates)) {
    throw new Error(`Packed manifest coordinate drift: ${JSON.stringify(actualCoordinates)}`);
  }
  if (JSON.stringify(packedManifest.exports) !== JSON.stringify({
    '.': { types: './src/index.d.ts', default: './src/index.js' },
  })) {
    throw new Error('Packed manifest export map drifted.');
  }

  const consumer = path.join(temp, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify({
    name: 'kdna-react-packed-audit',
    private: true,
    type: 'module',
  }, null, 2)}\n`);
  execFileSync('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    archive, 'react@18.3.1', 'react-dom@18.3.1', '@types/react@18.3.31',
  ], { cwd: consumer, stdio: ['ignore', 'pipe', 'pipe'] });
  const installedRoot = path.join(consumer, 'node_modules/@aikdna/kdna-react');
  const runtime = await import(`${pathToFileURL(path.join(installedRoot, 'src/index.js')).href}?audit=${Date.now()}`);
  const runtimeExports = Object.keys(runtime).sort();
  if (JSON.stringify(runtimeExports) !== JSON.stringify(expectedRuntimeExports)) {
    throw new Error(`Packed runtime export drift: ${runtimeExports.join(', ')}`);
  }
  const declaration = fs.readFileSync(path.join(installedRoot, 'src/index.d.ts'), 'utf8');
  for (const exported of expectedRuntimeExports) {
    if (exported === 'KDNA_SCHEMA_AUTHORITY') continue;
    if (!new RegExp(`(?:class|function) ${exported}\\b`, 'u').test(declaration)) {
      throw new Error(`Packed declaration omits runtime export ${exported}.`);
    }
  }
  fs.writeFileSync(path.join(consumer, 'component-smoke.tsx'), `
    import {
      KDNAFileDropzone,
      KDNALicenseActivationForm,
      KDNALoadPlanGate,
      type KDNAActivationEntitlement,
    } from '@aikdna/kdna-react';
    const dropzone = <KDNAFileDropzone endpoint="/api/kdna">
      {({ inspect }) => <pre>{JSON.stringify(inspect)}</pre>}
    </KDNAFileDropzone>;
    const gate = <KDNALoadPlanGate endpoint="/api/kdna" fileId="file-types">
      {({ content }) => <pre>{JSON.stringify(content)}</pre>}
    </KDNALoadPlanGate>;
    const activation = <KDNALicenseActivationForm
      endpoint="/api/kdna"
      domain="KDNA:Team.Name:Asset.Part:Variant_1"
      onActivated={(value: KDNAActivationEntitlement) => value.license_id}
    />;
    void [dropzone, gate, activation];
  `);
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      jsx: 'react-jsx',
      skipLibCheck: false,
    },
    include: ['component-smoke.tsx'],
  }, null, 2)}\n`);
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json'], {
    cwd: consumer,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const react19Consumer = path.join(temp, 'consumer-react19');
  fs.mkdirSync(react19Consumer);
  fs.writeFileSync(path.join(react19Consumer, 'package.json'), `${JSON.stringify({
    name: 'kdna-react-19-packed-audit',
    private: true,
    type: 'module',
  }, null, 2)}\n`);
  execFileSync('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    archive, 'react@19.2.7', 'react-dom@19.2.7',
    'react-test-renderer@19.2.7', '@types/react@19.2.17',
  ], { cwd: react19Consumer, stdio: ['ignore', 'pipe', 'pipe'] });
  const react19Require = createRequire(path.join(react19Consumer, 'package.json'));
  const React19 = react19Require('react');
  const { renderToStaticMarkup } = react19Require('react-dom/server');
  const TestRenderer19 = react19Require('react-test-renderer');
  const runtime19 = await import(`${pathToFileURL(path.join(
    react19Consumer,
    'node_modules/@aikdna/kdna-react/src/index.js',
  )).href}?audit=${Date.now()}`);
  const html19 = renderToStaticMarkup(React19.createElement(runtime19.KDNAAssetInspector, {
    inspect: { domain: 'KDNA:Team.Name:React19.Asset', encrypted: false },
  }));
  if (!html19.includes('Domain: KDNA:Team.Name:React19.Asset')) {
    throw new Error('Packed package failed React 19 SSR compatibility.');
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let form19;
  await TestRenderer19.act(async () => {
    form19 = TestRenderer19.create(React19.createElement(runtime19.KDNALicenseActivationForm, {
      endpoint: '/api/kdna',
      domain: 'kdna:test:react19-old',
    }));
  });
  await TestRenderer19.act(async () => {
    form19.root.findByType('input').props.onChange({ target: { value: 'synthetic-secret' } });
  });
  await TestRenderer19.act(async () => {
    form19.update(React19.createElement(runtime19.KDNALicenseActivationForm, {
      endpoint: '/api/kdna',
      domain: 'kdna:test:react19-current',
    }));
  });
  if (form19.root.findByType('input').props.value !== '') {
    throw new Error('Packed package failed React 19 form identity compatibility.');
  }
  await TestRenderer19.act(async () => form19.unmount());
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  fs.copyFileSync(
    path.join(consumer, 'component-smoke.tsx'),
    path.join(react19Consumer, 'component-smoke.tsx'),
  );
  fs.copyFileSync(
    path.join(consumer, 'tsconfig.json'),
    path.join(react19Consumer, 'tsconfig.json'),
  );
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json'], {
    cwd: react19Consumer,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const golden = JSON.parse(fs.readFileSync(
    path.join(root, 'vendor/core-1e77e3e/runtime-contract-golden.json'),
    'utf8',
  )).trace;

  for (const [name, trace] of hostileTraces(golden)) {
    if (runtime.validateTrace(trace).valid) {
      throw new Error(`validateTrace accepted hostile packed trace: ${name}`);
    }
    mustThrow(() => runtime.parseTrace(JSON.stringify(trace)), name, 'parseTrace');
    mustThrow(() => runtime.useTrace(trace), name, 'useTrace');
    mustThrow(() => runtime.tracePrimaryLabel(trace), name, 'tracePrimaryLabel');
    mustThrow(() => runtime.traceIsOverBudget(trace), name, 'traceIsOverBudget');
    mustThrow(() => runtime.traceResultDigest(trace), name, 'traceResultDigest');
    mustThrow(() => runtime.KDNATraceViewer({ trace, visible: true }), name, 'KDNATraceViewer');
  }

  console.log('Cold-installed npm tar has exact 0.3.0 files/exports, React 18/19 TSX+runtime compatibility, and rejects all 5 hostile traces.');
} finally {
  fs.rmSync(archive, { force: true });
  fs.rmSync(temp, { recursive: true, force: true });
}
