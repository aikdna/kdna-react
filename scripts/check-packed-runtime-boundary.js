#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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
const temp = fs.mkdtempSync(path.join(root, '.runtime-pack-audit-'));

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
  const runtime = await import(`${pathToFileURL(path.join(temp, 'package/src/index.js')).href}?audit=${Date.now()}`);
  const golden = JSON.parse(fs.readFileSync(
    path.join(root, 'vendor/core-ca6ede2/runtime-contract-golden.json'),
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

  console.log('Actual npm tar exposes one guarded useTrace implementation; all 5 hostile traces were rejected at every packed boundary.');
} finally {
  fs.rmSync(archive, { force: true });
  fs.rmSync(temp, { recursive: true, force: true });
}
