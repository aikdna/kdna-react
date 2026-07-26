import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { File as NodeFile } from 'node:buffer';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { KDNAFileDropzone } from '../src/index.js';

const { create } = TestRenderer;
const FileCtor = globalThis.File || NodeFile;

let inspectedUrls = [];
let renderer = null;
let fetchRestore = null;

afterEach(() => {
  act(() => {
    if (renderer) {
      renderer.unmount();
      renderer = null;
    }
  });
  if (typeof fetchRestore === 'function') {
    fetchRestore();
    fetchRestore = null;
  }
  inspectedUrls = [];
});

function installMockFetch() {
  const originalFetch = globalThis.fetch;
  fetchRestore = () => { globalThis.fetch = originalFetch; };
  globalThis.fetch = (url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    inspectedUrls.push(urlStr);
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({
        inspect: {
          fileId: 'test-file',
          manifest: {
            schema_version: '1.0',
            asset_id: 'test',
            format_version: '1.0',
            content_digest: 'sha256:aa',
            entry_set_digest: 'sha256:bb',
            mimetype: 'application/x-kdna',
          },
        },
      }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  };
}

function makeDropzone(baseUrl) {
  return React.createElement(KDNAFileDropzone, { endpoint: baseUrl });
}

async function uploadAndGetUrls(baseUrl) {
  installMockFetch();
  renderer = create(makeDropzone(baseUrl));
  const file = new FileCtor(
    [new Uint8Array(16).buffer],
    'test.kdna',
    { type: 'application/x-kdna' },
  );
  const input = renderer.root.findByType('input');
  await act(async () => {
    await input.props.onChange({ target: { files: [file] }, preventDefault: () => {}, stopPropagation: () => {} });
  });
  return inspectedUrls;
}

test('inspect URL has no double slash with clean base', async () => {
  const urls = await uploadAndGetUrls('https://example.com');
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  assert.equal(inspectUrl, 'https://example.com/inspect');
});

test('inspect URL strips one trailing slash', async () => {
  const urls = await uploadAndGetUrls('https://example.com/');
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  assert.equal(inspectUrl, 'https://example.com/inspect');
});

test('inspect URL strips many trailing slashes', async () => {
  const urls = await uploadAndGetUrls('https://example.com////');
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  assert.equal(inspectUrl, 'https://example.com/inspect');
});

test('inspect URL with slash-only base', async () => {
  const urls = await uploadAndGetUrls('/');
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  assert.equal(inspectUrl, '/inspect');
});

test('inspect URL with 100k trailing slashes', async () => {
  const prefix = 'https://example.com/path';
  const base = prefix + '/'.repeat(100000);
  const urls = await uploadAndGetUrls(base);
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  assert.equal(inspectUrl, prefix + '/inspect');
});

test('inspect URL preserves non-slash suffix after 50k slash run', async () => {
  const prefix = 'https://example.com/path';
  const base = prefix + '/'.repeat(50000) + 'x';
  const urls = await uploadAndGetUrls(base);
  const inspectUrl = urls.find((u) => u.includes('/inspect'));
  const slashes = '/'.repeat(50000);
  assert.equal(inspectUrl, `${prefix}${slashes}x/inspect`);
});
