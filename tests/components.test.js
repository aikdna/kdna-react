import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { File as NodeFile } from 'node:buffer';
import fs from 'node:fs';
import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  KDNAFileDropzone,
  KDNALicenseActivationForm,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  useKDNA,
  useKDNALoadPlan,
} from '../src/index.js';

const { create } = TestRenderer;
const FileCtor = globalThis.File || NodeFile;
const originalFetch = globalThis.fetch;
const golden = JSON.parse(fs.readFileSync(
  new URL('../vendor/core-1e77e3e/runtime-contract-golden.json', import.meta.url),
  'utf8',
));

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function readyPlan() {
  return {
    canProceed: true,
    missing: [],
    plan: {
      format_version: '0.1.0',
      access: 'public',
      state: 'ready',
      required_action: 'load',
      can_load_now: true,
      projection_policy: 'minimal',
      checks: { overall_valid: true },
    },
  };
}

function validLoad() {
  const capsule = structuredClone(golden.request.capsule);
  return { capsule, content: capsule.context, private_path: '/private/load' };
}

function validEntitlement(overrides = {}) {
  return {
    version: '1.0',
    license_id: 'lic_react_test',
    domain: 'kdna:test:react',
    issued_to: null,
    issued_at: '2026-07-18T00:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    status: 'active',
    revoked: false,
    revoked_at: null,
    revocation_reason: null,
    require_machine_binding: false,
    require_online_check: true,
    offline_grace_days: 7,
    allowed_agents: null,
    last_checked_at: '2026-07-18T00:00:01.000Z',
    offline_valid_until: '2099-01-01T00:00:01.000Z',
    updated_at: '2026-07-18T00:00:01.000Z',
    signature_base64: `${'A'.repeat(86)}==`,
    ...overrides,
  };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function HookProbe({ options, onValue }) {
  const value = useKDNA(options);
  useEffect(() => onValue(value));
  return null;
}

function PlanProbe({ context, onValue }) {
  const value = useKDNALoadPlan({
    endpoint: '/api/kdna',
    fileId: 'file-context',
    context,
  });
  useEffect(() => onValue(value));
  return null;
}

test('useKDNALoadPlan treats equivalent inline contexts as one request', async () => {
  let planCalls = 0;
  globalThis.fetch = async () => {
    planCalls += 1;
    return json(readyPlan());
  };
  let latest;
  let renderer;
  const probe = (context) => React.createElement(PlanProbe, {
    context,
    onValue: (value) => { latest = value; },
  });
  await act(async () => {
    renderer = create(probe({ nested: { beta: 2, alpha: 1 } }));
    await flush();
  });
  assert.equal(latest.status, 'ready');
  assert.equal(planCalls, 1);

  await act(async () => {
    renderer.update(probe({ nested: { alpha: 1, beta: 2 } }));
    await flush();
  });
  assert.equal(latest.status, 'ready');
  assert.equal(planCalls, 1);
  renderer.unmount();
});

test('useKDNALoadPlan rejects cyclic context before a request', async () => {
  let planCalls = 0;
  globalThis.fetch = async () => {
    planCalls += 1;
    return json(readyPlan());
  };
  const context = {};
  context.self = context;
  let latest;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(PlanProbe, {
      context,
      onValue: (value) => { latest = value; },
    }));
    await flush();
  });
  assert.equal(planCalls, 0);
  assert.equal(latest.status, 'error');
  assert.match(latest.error.message, /finite, credential-free JSON object/u);
  renderer.unmount();
});

test('useKDNALoadPlan rejects credentials instead of retaining them in context', async () => {
  let planCalls = 0;
  globalThis.fetch = async () => {
    planCalls += 1;
    return json(readyPlan());
  };
  let latest;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(PlanProbe, {
      context: { nested: { licenseKey: 'synthetic-secret' } },
      onValue: (value) => { latest = value; },
    }));
    await flush();
  });
  assert.equal(planCalls, 0);
  assert.equal(latest.status, 'error');
  assert.doesNotMatch(JSON.stringify(latest.error), /synthetic-secret/u);
  renderer.unmount();
});

test('useKDNALoadPlan preserves documented signed entitlement and budget context', async () => {
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return json(readyPlan());
  };
  let latest;
  let renderer;
  const context = {
    entitlementToken: { status: 'active', signature_base64: `${'A'.repeat(86)}==` },
    token_budget: 2048,
  };
  await act(async () => {
    renderer = create(React.createElement(PlanProbe, {
      context,
      onValue: (value) => { latest = value; },
    }));
    await flush();
  });
  assert.equal(latest.status, 'ready');
  assert.deepEqual(requestBody.context, context);
  renderer.unmount();
});

test('a stale refresh callback cannot cancel the current context request', async () => {
  let resolveCurrent;
  let planCalls = 0;
  globalThis.fetch = async (_url, init) => {
    planCalls += 1;
    const body = JSON.parse(init.body);
    if (body.context.generation === 'current') {
      return new Promise((resolve) => { resolveCurrent = resolve; });
    }
    return json(readyPlan());
  };
  let latest;
  let renderer;
  const probe = (generation) => React.createElement(PlanProbe, {
    context: { generation },
    onValue: (value) => { latest = value; },
  });
  await act(async () => {
    renderer = create(probe('old'));
    await flush();
  });
  const staleRefresh = latest.refresh;
  await act(async () => {
    renderer.update(probe('current'));
    await flush();
  });
  assert.equal(await staleRefresh(), null);
  assert.equal(planCalls, 2);
  resolveCurrent(json(readyPlan()));
  await act(flush);
  assert.equal(latest.status, 'ready');
  renderer.unmount();
});

test('a stale load callback cannot cancel the current file request', async () => {
  let resolveCurrent;
  const loadedFileIds = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/plan-load')) return json(readyPlan());
    const body = JSON.parse(init.body);
    loadedFileIds.push(body.fileId);
    return new Promise((resolve) => { resolveCurrent = resolve; });
  };
  let latest;
  let renderer;
  const probe = (fileId) => React.createElement(HookProbe, {
    options: { endpoint: '/api/kdna', fileId },
    onValue: (value) => { latest = value; },
  });
  await act(async () => {
    renderer = create(probe('file-old'));
    await flush();
  });
  const staleLoad = latest.load;
  await act(async () => {
    renderer.update(probe('file-current'));
    await flush();
  });
  let currentLoad;
  await act(async () => {
    currentLoad = latest.load();
    await flush();
  });
  assert.equal(await staleLoad(), null);
  assert.deepEqual(loadedFileIds, ['file-current']);
  resolveCurrent(json(validLoad()));
  await act(async () => {
    await currentLoad;
    await flush();
  });
  assert.equal(typeof latest.content, 'object');
  renderer.unmount();
});

test('useKDNA accepts only Web Client validated Runtime Capsules and returns object content', async () => {
  let hostile = false;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/plan-load')) return json(readyPlan());
    const loaded = validLoad();
    if (hostile) loaded.capsule.forged = true;
    return json(loaded);
  };

  let latest;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(HookProbe, {
      options: { endpoint: '/api/kdna', fileId: 'file-1', profile: 'compact' },
      onValue: (value) => { latest = value; },
    }));
    await flush();
  });

  let result;
  await act(async () => {
    result = await latest.load();
    await flush();
  });
  assert.equal(result.capsule.type, 'kdna.runtime-capsule');
  assert.equal(typeof latest.content, 'object');
  assert.equal(result.private_path, undefined);

  hostile = true;
  let caught;
  await act(async () => {
    try {
      await latest.load();
    } catch (error) {
      caught = error;
    }
    await flush();
  });
  assert.equal(caught.code, 'KDNA_RUNTIME_CAPSULE_INVALID');
  assert.equal(caught.response, null);
  renderer.unmount();
});

test('KDNALoadPlanGate never renders an upstream error body', async () => {
  const secret = 'synthetic-provider-private-value';
  globalThis.fetch = async () => json({
    error: { code: 'KDNA_ACCESS_DENIED', message: `/private/provider/${secret}` },
    provider: { detail: secret },
  }, 403);

  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNALoadPlanGate, {
      endpoint: '/api/kdna',
      fileId: 'file-1',
    }, ({ error }) => React.createElement('p', { role: 'alert' }, error?.message || 'waiting')));
    await flush();
  });

  const rendered = JSON.stringify(renderer.toJSON());
  assert.doesNotMatch(rendered, new RegExp(secret));
  assert.doesNotMatch(rendered, /private\/provider/u);
  assert.match(rendered, /KDNA request failed with HTTP 403/u);
  renderer.unmount();
});

test('KDNAFileDropzone uses the bounded public inspect projection', async () => {
  globalThis.fetch = async () => json({
    fileId: 'file-1',
    domain: 'kdna:test:react',
    version: '0.1.0',
    title: 'React Asset',
    encrypted: false,
    defaultProfile: 'compact',
    internal_path: '/private/upload',
  });
  const file = new FileCtor(['asset'], 'asset.kdna', {
    type: 'application/vnd.kdna.asset',
  });
  let state;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNAFileDropzone, {
      endpoint: '/api/kdna',
    }, (value) => {
      state = value;
      return React.createElement('p', null, value.inspect?.domain || 'waiting');
    }));
  });
  const input = renderer.root.findByType('input');
  await act(async () => {
    input.props.onChange({ target: { files: [file] } });
    await flush();
  });
  assert.equal(state.fileId, 'file-1');
  assert.equal(state.inspect.domain, 'kdna:test:react');
  assert.equal(state.inspect.internal_path, undefined);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /private\/upload/u);
  renderer.unmount();
});

test('password dialog clears state before completing a validated load', async () => {
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return json(validLoad());
  };
  let unlocked;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNAPasswordUnlockDialog, {
      endpoint: '/api/kdna',
      fileId: 'file-1',
      onUnlock: (result) => { unlocked = result; },
    }));
  });
  const input = renderer.root.findByType('input');
  assert.equal(input.props.type, 'password');
  await act(async () => input.props.onChange({ target: { value: 'synthetic-password' } }));
  assert.equal(renderer.root.findByType('input').props.value, 'synthetic-password');
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(requestBody.password, 'synthetic-password');
  assert.equal(renderer.root.findByType('input').props.value, '');
  assert.equal(typeof unlocked.content, 'object');
  renderer.unmount();
});

test('license form sends canonical machine binding, clears the key, and projects entitlement', async () => {
  const machineFingerprint = 'a'.repeat(64);
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return json(validEntitlement({
      license_id: 'lic_react_bound',
      require_machine_binding: true,
      machine_fingerprint: machineFingerprint,
      internal_path: '/private/activation',
    }));
  };
  let entitlement;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNALicenseActivationForm, {
      domain: 'kdna:test:react',
      endpoint: '/api/kdna',
      machineFingerprint,
      client: 'react-integration-test',
      onActivated: (value) => { entitlement = value; },
    }));
  });
  const input = renderer.root.findByType('input');
  assert.equal(input.props.type, 'password');
  await act(async () => input.props.onChange({ target: { value: 'synthetic-license-secret' } }));
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.deepEqual(requestBody, {
    domain: 'kdna:test:react',
    license_key: 'synthetic-license-secret',
    machine_fingerprint: machineFingerprint,
    client: 'react-integration-test',
  });
  assert.equal(renderer.root.findByType('input').props.value, '');
  assert.equal(entitlement.machine_fingerprint, machineFingerprint);
  assert.equal(entitlement.internal_path, undefined);
  renderer.unmount();
});

test('license form rejects hostile values inside allowlisted entitlement fields', async () => {
  const secret = 'synthetic-entitlement-private-value';
  globalThis.fetch = async () => json(validEntitlement({
    allowed_agents: [{ private_path: `/private/${secret}` }],
  }));
  let entitlement;
  let observedError;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNALicenseActivationForm, {
      domain: 'kdna:test:react',
      endpoint: '/api/kdna',
      onActivated: (value) => { entitlement = value; },
      onError: (error) => { observedError = error; },
    }));
  });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: 'synthetic-license' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(entitlement, undefined);
  assert.equal(observedError.code, 'KDNA_ACTIVATION_RESPONSE_INVALID');
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), new RegExp(secret));
  renderer.unmount();
});

test('license form rejects expired entitlements and expired online leases', async () => {
  for (const hostile of [
    { expires_at: '2020-01-01T00:00:00.000Z' },
    { require_online_check: true, offline_valid_until: '2020-01-01T00:00:00.000Z' },
    { require_online_check: undefined },
  ]) {
    globalThis.fetch = async () => json(validEntitlement(hostile));
    let entitlement;
    let observedError;
    let renderer;
    await act(async () => {
      renderer = create(React.createElement(KDNALicenseActivationForm, {
        domain: 'kdna:test:react',
        endpoint: '/api/kdna',
        onActivated: (value) => { entitlement = value; },
        onError: (error) => { observedError = error; },
      }));
    });
    await act(async () => {
      renderer.root.findByType('input').props.onChange({ target: { value: 'synthetic-license' } });
    });
    await act(async () => {
      await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
    });
    assert.equal(entitlement, undefined);
    assert.equal(observedError.code, 'KDNA_ACTIVATION_RESPONSE_INVALID');
    renderer.unmount();
  }
});

test('password dialog clears and ignores an old request when file identity changes', async () => {
  let resolveOld;
  globalThis.fetch = async () => new Promise((resolve) => { resolveOld = resolve; });
  const unlocked = [];
  const view = (fileId) => React.createElement(KDNAPasswordUnlockDialog, {
    endpoint: '/api/kdna',
    fileId,
    onUnlock: () => unlocked.push(fileId),
  });
  let renderer;
  await act(async () => { renderer = create(view('file-old')); });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: 'old-password' } });
  });
  let pending;
  await act(async () => {
    pending = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
    await flush();
  });
  await act(async () => {
    renderer.update(view('file-new'));
    await flush();
  });
  assert.equal(renderer.root.findByType('input').props.value, '');
  resolveOld(json(validLoad()));
  await act(async () => {
    await pending;
    await flush();
  });
  assert.deepEqual(unlocked, []);
  renderer.unmount();
});

test('license form clears and ignores an old request when domain identity changes', async () => {
  let resolveOld;
  globalThis.fetch = async () => new Promise((resolve) => { resolveOld = resolve; });
  const activated = [];
  const view = (domain) => React.createElement(KDNALicenseActivationForm, {
    endpoint: '/api/kdna',
    domain,
    onActivated: () => activated.push(domain),
  });
  let renderer;
  await act(async () => { renderer = create(view('kdna:test:old')); });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: 'old-license' } });
  });
  let pending;
  await act(async () => {
    pending = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
    await flush();
  });
  await act(async () => {
    renderer.update(view('kdna:test:new'));
    await flush();
  });
  assert.equal(renderer.root.findByType('input').props.value, '');
  resolveOld(json(validEntitlement({ domain: 'kdna:test:old' })));
  await act(async () => {
    await pending;
    await flush();
  });
  assert.deepEqual(activated, []);
  renderer.unmount();
});

test('license form keeps rejected activation bodies out of state and rendered UI', async () => {
  const secret = 'synthetic-activation-private-value';
  globalThis.fetch = async () => json({
    error: { code: 'KDNA_ACTIVATION_REJECTED', message: `/private/issuer/${secret}` },
    provider: { detail: secret },
  }, 403);
  let observedError;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNALicenseActivationForm, {
      domain: 'kdna:test:react',
      endpoint: '/api/kdna',
      onError: (error) => { observedError = error; },
    }));
  });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { value: 'synthetic-license' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(observedError.code, 'KDNA_ACTIVATION_REJECTED');
  assert.equal(observedError.response, null);
  assert.doesNotMatch(JSON.stringify(observedError), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), new RegExp(secret));
  assert.equal(renderer.root.findByType('input').props.value, '');
  renderer.unmount();
});

test('load gate reports one failed automatic load without retrying in a loop', async () => {
  let loadCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/plan-load')) return json(readyPlan());
    loadCalls += 1;
    return json({ error: { code: 'KDNA_LOAD_FAILED', message: 'private detail' } }, 500);
  };
  let state;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNALoadPlanGate, {
      endpoint: '/api/kdna',
      fileId: 'file-retry',
    }, (value) => {
      state = value;
      return React.createElement('p', null, value.status);
    }));
    await flush();
  });
  for (let attempt = 0; attempt < 5; attempt += 1) await act(flush);
  assert.equal(loadCalls, 1);
  assert.equal(state.status, 'error');
  assert.equal(state.error.response, null);
  renderer.unmount();
});

test('useKDNA discards an old load result after fileId changes', async () => {
  let resolveOldLoad;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/plan-load')) return json(readyPlan());
    const body = JSON.parse(init.body);
    if (body.fileId === 'file-old') {
      return new Promise((resolve) => { resolveOldLoad = () => resolve(json(validLoad())); });
    }
    return json(validLoad());
  };

  let latest;
  let renderer;
  const probe = (fileId) => React.createElement(HookProbe, {
    options: { endpoint: '/api/kdna', fileId, profile: 'compact' },
    onValue: (value) => { latest = value; },
  });
  await act(async () => {
    renderer = create(probe('file-old'));
    await flush();
  });
  let oldLoad;
  await act(async () => {
    oldLoad = latest.load();
    await flush();
  });
  await act(async () => {
    renderer.update(probe('file-new'));
    await flush();
  });
  resolveOldLoad();
  let oldResult;
  await act(async () => {
    oldResult = await oldLoad;
    await flush();
  });
  assert.equal(oldResult, null);
  assert.equal(latest.content, null);

  await act(async () => {
    await latest.load();
    await flush();
  });
  assert.equal(typeof latest.content, 'object');
  renderer.unmount();
});

test('dropzone discards an older upload response after a new selection', async () => {
  const pending = [];
  globalThis.fetch = async () => new Promise((resolve) => pending.push(resolve));
  const first = new FileCtor(['first'], 'first.kdna', { type: 'application/vnd.kdna.asset' });
  const second = new FileCtor(['second'], 'second.kdna', { type: 'application/vnd.kdna.asset' });
  let state;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(KDNAFileDropzone, {
      endpoint: '/api/kdna',
    }, (value) => {
      state = value;
      return React.createElement('p', null, value.fileId || 'waiting');
    }));
  });
  const input = renderer.root.findByType('input');
  await act(async () => {
    input.props.onChange({ target: { files: [first] } });
    await flush();
    input.props.onChange({ target: { files: [second] } });
    await flush();
  });
  assert.equal(pending.length, 2);
  pending[1](json({ fileId: 'file-new', domain: 'kdna:test:new' }));
  await act(flush);
  assert.equal(state.fileId, 'file-new');
  assert.equal(state.file.name, 'second.kdna');

  pending[0](json({ fileId: 'file-old', domain: 'kdna:test:old' }));
  await act(flush);
  assert.equal(state.fileId, 'file-new');
  assert.equal(state.file.name, 'second.kdna');
  renderer.unmount();
});

test('dropzone resets and discards an upload after endpoint changes', async () => {
  let resolveOld;
  globalThis.fetch = async () => new Promise((resolve) => { resolveOld = resolve; });
  const file = new FileCtor(['asset'], 'asset.kdna', { type: 'application/vnd.kdna.asset' });
  let state;
  const view = (endpointValue) => React.createElement(KDNAFileDropzone, {
    endpoint: endpointValue,
  }, (value) => {
    state = value;
    return React.createElement('p', null, value.fileId || 'waiting');
  });
  let renderer;
  await act(async () => { renderer = create(view('/api/old')); });
  await act(async () => {
    renderer.root.findByType('input').props.onChange({ target: { files: [file] } });
    await flush();
  });
  await act(async () => {
    renderer.update(view('/api/current'));
    await flush();
  });
  assert.equal(state.file, null);
  resolveOld(json({ fileId: 'file-old', domain: 'kdna:test:old' }));
  await act(flush);
  assert.equal(state.fileId, null);
  assert.equal(state.inspect, null);
  assert.equal(state.identity, undefined);
  renderer.unmount();
});

test('host success callbacks do not become component request errors', async () => {
  globalThis.fetch = async (url) => (
    String(url).endsWith('/activate') ? json(validEntitlement()) : json(validLoad())
  );
  for (const candidate of [
    {
      element: React.createElement(KDNAPasswordUnlockDialog, {
        endpoint: '/api/kdna',
        fileId: 'file-callback',
        onUnlock: () => { throw new Error('host password callback failed'); },
      }),
      value: 'synthetic-password',
      expected: /host password callback failed/u,
    },
    {
      element: React.createElement(KDNALicenseActivationForm, {
        endpoint: '/api/kdna',
        domain: 'kdna:test:react',
        onActivated: () => { throw new Error('host activation callback failed'); },
      }),
      value: 'synthetic-license',
      expected: /host activation callback failed/u,
    },
  ]) {
    let renderer;
    await act(async () => { renderer = create(candidate.element); });
    await act(async () => {
      renderer.root.findByType('input').props.onChange({ target: { value: candidate.value } });
    });
    let caught;
    await act(async () => {
      try {
        await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
      } catch (error) {
        caught = error;
      }
    });
    assert.match(caught.message, candidate.expected);
    assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
    renderer.unmount();
  }
});
