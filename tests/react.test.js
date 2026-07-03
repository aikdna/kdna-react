import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KDNAAssetInspector,
  KDNACreatorWizard,
  KDNAExportButton,
  KDNAFileDropzone,
  KDNALicenseActivationForm,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  useKDNA,
  useKDNALoadPlan,
} from '../src/index.js';

test('exports expected components and hooks', () => {
  for (const value of [
    KDNAAssetInspector,
    KDNACreatorWizard,
    KDNAExportButton,
    KDNAFileDropzone,
    KDNALicenseActivationForm,
    KDNALoadPlanGate,
    KDNAPasswordUnlockDialog,
    useKDNA,
    useKDNALoadPlan,
  ]) {
    assert.equal(typeof value, 'function');
  }
});

test('KDNAAssetInspector renders stable public metadata', () => {
  const html = renderToStaticMarkup(React.createElement(KDNAAssetInspector, {
    inspect: {
      domain: 'kdna:test:react',
      title: 'React Asset',
      version: '0.1.0',
      description: 'Renderable metadata',
      profiles: ['index', 'compact'],
    },
  }));

  assert.match(html, /React Asset/);
  assert.match(html, /0.1.0/);
  assert.match(html, /compact/);
});

test('form components render without browser-only globals during SSR', () => {
  const password = renderToStaticMarkup(React.createElement(KDNAPasswordUnlockDialog, {
    fileId: 'file-1',
    endpoint: '/api/kdna',
  }));
  assert.match(password, /type="password"/);

  const license = renderToStaticMarkup(React.createElement(KDNALicenseActivationForm, {
    domain: 'kdna:test:react',
    endpoint: '/api/kdna',
  }));
  assert.match(license, /Activate/);
});
