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
