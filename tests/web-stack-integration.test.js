import { test } from 'node:test';
import assert from 'node:assert/strict';
import { File as NodeFile } from 'node:buffer';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import activation from '@aikdna/kdna-activation-server';
import { createKDNAServer } from '@aikdna/kdna-web-server';
import {
  KDNAFileDropzone,
  KDNALicenseActivationForm,
  KDNALoadPlanGate,
} from '../src/index.js';

const { create } = TestRenderer;
const FileCtor = globalThis.File || NodeFile;

async function startHttpBridge(server) {
  const requests = [];
  const listener = http.createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const address = listener.address();
      const url = `http://127.0.0.1:${address.port}${request.url}`;
      const result = await server.handle(new Request(url, {
        method: request.method,
        headers: request.headers,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: Buffer.concat(chunks) }),
      }));
      requests.push({ path: request.url, status: result.status });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'KDNA_INTEGRATION_BRIDGE_FAILED' } }));
    }
  });
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/kdna`,
    requests,
    async close() {
      listener.close();
      await once(listener, 'close');
    },
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(flush);
  }
  throw new Error('React integration state did not converge');
}

test('React completes real HTTP inspect, plan-load, and load with the accepted asset', async () => {
  const assetPath = process.env.KDNA_REACT_ASSET;
  assert.ok(assetPath, 'KDNA_REACT_ASSET must point to an accepted public .kdna fixture');
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kdna-react-web-'));
  const server = createKDNAServer({ storageDir });
  const bridge = await startHttpBridge(server);
  const file = new FileCtor(
    [fs.readFileSync(assetPath)],
    'laozi-wuwei-0.1.1.kdna',
    { type: 'application/vnd.kdna.asset' },
  );
  let dropzoneState;
  let gateState;
  let renderer;

  function Flow() {
    return React.createElement(KDNAFileDropzone, { endpoint: bridge.baseUrl }, (dropzone) => {
      dropzoneState = dropzone;
      if (!dropzone.fileId) return React.createElement('p', null, 'waiting');
      return React.createElement(KDNALoadPlanGate, {
        endpoint: bridge.baseUrl,
        fileId: dropzone.fileId,
      }, (gate) => {
        gateState = gate;
        return React.createElement(
          'pre',
          null,
          gate.content ? JSON.stringify(gate.content, null, 2) : gate.status,
        );
      });
    });
  }

  try {
    await act(async () => { renderer = create(React.createElement(Flow)); });
    await act(async () => {
      renderer.root.findByType('input').props.onChange({ target: { files: [file] } });
      await flush();
    });
    await waitFor(() => gateState?.status === 'loaded');

    assert.equal(dropzoneState.inspect.domain, 'kdna:aikdna:laozi-wuwei');
    assert.equal(dropzoneState.inspect.version, '0.1.1');
    assert.equal(typeof gateState.content, 'object');
    assert.equal(typeof gateState.content.highest_question, 'string');
    const rendered = JSON.stringify(renderer.toJSON());
    assert.match(rendered, /highest_question/u);
    assert.doesNotMatch(rendered, /\[object Object\]/u);
    assert.doesNotMatch(rendered, new RegExp(storageDir));
    assert.deepEqual(
      bridge.requests.map((request) => [request.path, request.status]),
      [
        ['/api/kdna/inspect', 200],
        ['/api/kdna/plan-load', 200],
        ['/api/kdna/load', 200],
      ],
    );
  } finally {
    renderer?.unmount();
    await bridge.close();
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
});

test('React activates real bound and unbound Activation 0.2 licenses through Web Server 0.3', async () => {
  const activationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kdna-react-activation-'));
  const webStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kdna-react-activation-web-'));
  const store = activation.makeStore(activationDir);
  const keys = activation.ensureKeyPair(activationDir);
  const boundSecret = 'synthetic-bound-license-secret';
  const unboundSecret = 'synthetic-unbound-license-secret';
  const boundDomain = 'KDNA:Team.Name:Bound.React:Variant_1';
  store.create({
    domain: boundDomain,
    license_key: boundSecret,
    require_machine_binding: true,
  });
  store.create({
    domain: 'kdna:test:unbound-react',
    license_key: unboundSecret,
    require_machine_binding: false,
  });
  const activationServer = await activation.startServer({
    dataDir: activationDir,
    store,
    keys,
    port: 0,
  });
  const webServer = createKDNAServer({
    storageDir: webStorageDir,
    activationServerUrl: `http://127.0.0.1:${activationServer.port}`,
  });
  const bridge = await startHttpBridge(webServer);
  const machineFingerprint = 'a'.repeat(64);

  async function activate(props, secret) {
    let entitlement;
    let renderer;
    await act(async () => {
      renderer = create(React.createElement(KDNALicenseActivationForm, {
        endpoint: bridge.baseUrl,
        onActivated: (value) => { entitlement = value; },
        ...props,
      }));
    });
    await act(async () => {
      renderer.root.findByType('input').props.onChange({ target: { value: secret } });
    });
    await act(async () => {
      await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
    });
    assert.equal(renderer.root.findByType('input').props.value, '');
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), new RegExp(secret));
    renderer.unmount();
    return entitlement;
  }

  try {
    const bound = await activate({
      domain: boundDomain,
      machineFingerprint,
      client: 'kdna-react-integration',
    }, boundSecret);
    assert.equal(bound.status, 'active');
    assert.equal(bound.require_machine_binding, true);
    assert.equal(bound.machine_fingerprint, machineFingerprint);
    assert.equal(bound.license_key, undefined);

    const unbound = await activate({
      domain: 'kdna:test:unbound-react',
    }, unboundSecret);
    assert.equal(unbound.status, 'active');
    assert.equal(unbound.require_machine_binding, false);
    assert.equal(unbound.machine_fingerprint, undefined);
    assert.equal(unbound.license_key, undefined);

    assert.deepEqual(
      bridge.requests.map((request) => [request.path, request.status]),
      [
        ['/api/kdna/activate', 200],
        ['/api/kdna/activate', 200],
      ],
    );
  } finally {
    await bridge.close();
    await activation.stopServer(activationServer.server);
    fs.rmSync(activationDir, { recursive: true, force: true });
    fs.rmSync(webStorageDir, { recursive: true, force: true });
  }
});
