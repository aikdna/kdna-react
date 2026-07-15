import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KDNA_SCHEMA_AUTHORITY,
  validateJudgmentTrace as validateCanonicalJudgmentTrace,
} from './generated/runtime-validators.js';

export { KDNA_SCHEMA_AUTHORITY };

const h = React.createElement;

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`KDNA endpoint returned invalid JSON: ${error.message}`);
    }
  }
  if (!response.ok) {
    const error = new Error(payload.error?.message || `KDNA endpoint failed with HTTP ${response.status}.`);
    error.status = response.status;
    error.code = payload.error?.code;
    error.response = payload;
    throw error;
  }
  return payload;
}

function endpoint(base, path) {
  return `${String(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function defaultErrorHandler(error) {
  throw error;
}

export function useKDNALoadPlan({ endpoint: baseUrl, fileId, context, enabled = true } = {}) {
  const [state, setState] = useState({
    status: fileId ? 'checking' : 'idle',
    plan: null,
    missing: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!fileId || !enabled) {
      setState({ status: 'idle', plan: null, missing: [], error: null });
      return null;
    }

    setState((current) => ({ ...current, status: 'checking', error: null }));
    try {
      const response = await jsonFetch(endpoint(baseUrl, 'plan-load'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileId, context: context || {} }),
      });
      const plan = response.plan || response;
      const canProceed = Boolean(response.canProceed ?? plan.can_load_now);
      const next = {
        status: canProceed ? 'ready' : 'locked',
        plan,
        missing: response.missing || (canProceed ? [] : [plan.required_action].filter(Boolean)),
        error: null,
      };
      setState(next);
      return next;
    } catch (error) {
      const next = { status: 'error', plan: null, missing: [], error };
      setState(next);
      return next;
    }
  }, [baseUrl, context, enabled, fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}

export function useKDNA({ endpoint: baseUrl, fileId, profile = 'compact' } = {}) {
  const plan = useKDNALoadPlan({ endpoint: baseUrl, fileId });
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (options = {}) => {
    if (!fileId) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await jsonFetch(endpoint(baseUrl, 'load'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileId, profile, ...options }),
      });
      setContent(result.content);
      return result;
    } catch (loadError) {
      setError(loadError);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [baseUrl, fileId, profile]);

  return { ...plan, content, loading, error: error || plan.error, load };
}

export function KDNAFileDropzone({
  endpoint: baseUrl,
  onError = defaultErrorHandler,
  maxSizeBytes = 10 * 1024 * 1024,
  disabled = false,
  className,
  label = 'Choose a KDNA file',
  children,
}) {
  const inputRef = useRef(null);
  const [state, setState] = useState({ file: null, fileId: null, inspect: null, loading: false, error: null });

  const reset = useCallback(() => {
    setState({ file: null, fileId: null, inspect: null, loading: false, error: null });
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const upload = useCallback(async (file) => {
    if (disabled) return;
    if (!file) return;
    if (file.size > maxSizeBytes) {
      const error = new Error(`KDNA file exceeds maxSizeBytes (${maxSizeBytes}).`);
      setState((current) => ({ ...current, error }));
      onError(error);
      return;
    }

    setState({ file, fileId: null, inspect: null, loading: true, error: null });
    try {
      const form = new FormData();
      form.set('file', file, file.name || 'asset.kdna');
      const inspect = await jsonFetch(endpoint(baseUrl, 'inspect'), { method: 'POST', body: form });
      setState({ file, fileId: inspect.fileId, inspect, loading: false, error: null });
    } catch (error) {
      setState({ file, fileId: null, inspect: null, loading: false, error });
      onError(error);
    }
  }, [baseUrl, disabled, maxSizeBytes, onError]);

  const props = useMemo(() => ({
    role: 'button',
    tabIndex: 0,
    className,
    'aria-disabled': disabled || undefined,
    onClick: () => {
      if (!disabled) inputRef.current?.click();
    },
    onDragOver: (event) => event.preventDefault(),
    onDrop: (event) => {
      event.preventDefault();
      if (disabled) return;
      upload(event.dataTransfer.files?.[0]);
    },
    onKeyDown: (event) => {
      if (!disabled && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click();
    },
  }), [className, disabled, upload]);

  return h('div', props,
    h('input', {
      ref: inputRef,
      type: 'file',
      accept: '.kdna,application/vnd.kdna.asset',
      'aria-label': label,
      disabled,
      style: { display: 'none' },
      onChange: (event) => upload(event.target.files?.[0]),
    }),
    typeof children === 'function' ? children({ ...state, reset }) : children);
}

export function KDNALoadPlanGate({ fileId, endpoint: baseUrl, profile = 'compact', children }) {
  const kdna = useKDNA({ endpoint: baseUrl, fileId, profile });

  useEffect(() => {
    if (kdna.status === 'ready' && !kdna.content && !kdna.loading) {
      kdna.load().catch(() => {});
    }
  }, [kdna]);

  const childState = {
    status: kdna.content ? 'loaded' : kdna.status,
    content: kdna.content,
    missing: kdna.missing,
    error: kdna.error,
    loading: kdna.loading,
    load: kdna.load,
    plan: kdna.plan,
  };

  return typeof children === 'function' ? children(childState) : null;
}

export function KDNAPasswordUnlockDialog({
  fileId,
  endpoint: baseUrl,
  profile = 'compact',
  onUnlock,
  onCancel,
  onError,
  hint = null,
  title = 'Unlock asset',
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await jsonFetch(endpoint(baseUrl, 'load'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileId, profile, password }),
      });
      onUnlock?.(result);
    } catch (unlockError) {
      setError(unlockError);
      onError?.(unlockError);
    } finally {
      setLoading(false);
      setPassword('');
    }
  }

  return h('form', { role: 'dialog', 'aria-modal': 'true', onSubmit: submit },
    title ? h('h2', null, title) : null,
    h('label', null, 'Password',
      h('input', {
        type: 'password',
        value: password,
        onChange: (event) => setPassword(event.target.value),
        autoComplete: 'current-password',
      })),
    hint ? h('p', null, hint) : null,
    error ? h('p', { role: 'alert' }, error.message) : null,
    h('button', { type: 'submit', disabled: loading }, loading ? 'Unlocking...' : 'Unlock'),
    h('button', { type: 'button', onClick: onCancel }, 'Cancel'));
}

export function KDNALicenseActivationForm({
  domain,
  endpoint: baseUrl,
  onActivated,
  onError,
  label = 'License key',
  submitLabel = 'Activate',
}) {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await jsonFetch(endpoint(baseUrl, 'activate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain, license_key: licenseKey }),
      });
      onActivated?.(result.entitlementToken || result.token || result);
    } catch (activationError) {
      setError(activationError);
      onError?.(activationError);
    } finally {
      setLoading(false);
    }
  }

  return h('form', { onSubmit: submit },
    h('label', null, label,
      h('input', {
        type: 'text',
        value: licenseKey,
        onChange: (event) => setLicenseKey(event.target.value),
        autoComplete: 'off',
      })),
    error ? h('p', { role: 'alert' }, error.message) : null,
    h('button', { type: 'submit', disabled: loading }, loading ? 'Activating...' : submitLabel));
}

export function KDNAAssetInspector({
  inspect,
  showProfiles = true,
  showLoadPlan = true,
  className,
}) {
  if (!inspect) return null;
  const title = inspect.title || inspect.domain || inspect.asset?.title || 'KDNA asset';
  const version = inspect.version || inspect.asset?.version || '';
  const description = inspect.description || inspect.inspect?.description || inspect.inspect?.summary || '';
  const profiles = inspect.profiles || inspect.inspect?.profiles_available || [];
  const encrypted = Boolean(inspect.encrypted || inspect.inspect?.encrypted);
  const loadPlan = inspect.loadPlan || inspect.load_plan || inspect.inspect?.loadPlan || inspect.inspect?.load_plan || null;
  const loadPlanMode = loadPlan?.mode || loadPlan?.state || loadPlan?.required_action || null;
  const requirements = loadPlan?.requirements || loadPlan?.missing || [];

  return h('section', { className },
    h('h2', null, title),
    version ? h('p', null, version) : null,
    description ? h('p', null, description) : null,
    h('p', null, encrypted ? 'Encrypted' : 'Open'),
    showLoadPlan && loadPlanMode ? h('p', null, `Load plan: ${loadPlanMode}`) : null,
    showLoadPlan && requirements.length
      ? h('ul', null, requirements.map((requirement) => h('li', { key: requirement }, requirement)))
      : null,
    showProfiles && profiles.length ? h('ul', null, profiles.map((profile) => h('li', { key: profile }, profile))) : null);
}

// ── JudgmentTrace helpers ─────────────────────────────────────────────
// Full TypeScript types are in trace.ts. The public adapter accepts the
// ecosystem's current JudgmentTrace contract only and fails closed on stale
// or unknown shapes.
function canonicalValidationErrors() {
  return (validateCanonicalJudgmentTrace.errors ?? []).map((issue) => (
    `${issue.instancePath || '/'} ${issue.message || issue.keyword}`
  ));
}

export function parseTrace(json) {
  const parsed = JSON.parse(json);
  const validation = validateTrace(parsed);
  if (!validation.valid) throw new Error(`Invalid JudgmentTrace: ${validation.errors.join('; ')}`);
  return parsed;
}

export function validateTrace(trace) {
  const valid = validateCanonicalJudgmentTrace(trace);
  return { valid, errors: valid ? [] : canonicalValidationErrors() };
}
function requireJudgmentTrace(trace) {
  const validation = validateTrace(trace);
  if (!validation.valid) {
    throw new Error(`Invalid JudgmentTrace: ${validation.errors.join('; ')}`);
  }
  return trace;
}

export function tracePrimaryLabel(trace) {
  requireJudgmentTrace(trace);
  return trace.asset_identity?.asset_id ?? 'none';
}

export function traceIsOverBudget(trace) {
  requireJudgmentTrace(trace);
  return trace.budget?.comparison?.overall === 'exceeded';
}

export function traceResultDigest(trace) {
  requireJudgmentTrace(trace);
  return trace.result_ref?.result_digest ?? null;
}

// ── KDNATraceViewer — renders the current JudgmentTrace ──────────
export function KDNATraceViewer({ trace, visible = false } = {}) {
  if (!visible || !trace) return null;
  requireJudgmentTrace(trace);

  const primary = tracePrimaryLabel(trace);
  const status = trace.overall_status ?? 'unknown';
  const delivery = trace.execution?.delivery_status ?? 'unknown';
  const execution = trace.execution?.execution_status ?? 'unknown';
  const consumption = trace.execution?.semantic_consumption?.state ?? 'not_observed';
  const conformance = trace.execution?.conformance_status ?? 'not_evaluated';
  const resultDigest = traceResultDigest(trace);
  const overBudget = traceIsOverBudget(trace);
  const warnings = trace.warnings ?? [];
  const errors = trace.errors ?? [];
  const model = trace.execution?.model_identity?.basis === 'host_reported'
    ? trace.execution.model_identity.value
    : null;

  return h('div', { className: 'kdna-trace-viewer' },
    h('h3', null, `Trace: ${trace.trace_id}`),
    h('div', { className: 'kdna-trace-operation' },
      `Status: ${status}${model ? ` | Model: ${model}` : ''}`
    ),
    h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Primary'),
      h('div', null, `${primary} ${trace.asset_identity?.version ?? ''}`.trim())
    ),
    h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Observed boundaries'),
      h('div', null, `Delivery: ${delivery}`),
      h('div', null, `Execution: ${execution}`),
      h('div', null, `Semantic consumption: ${consumption}`),
      h('div', null, `Conformance: ${conformance}`)
    ),
    resultDigest && h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Result evidence'), h('div', null, resultDigest)
    ),
    overBudget && h('div', { className: 'kdna-trace-section kdna-over-budget' },
      h('h4', null, 'Budget'), 'Over budget'
    ),
    warnings.length > 0 && h('div', { className: 'kdna-trace-section kdna-warnings' },
      h('h4', null, 'Warnings'),
      warnings.map((w, i) => h('div', { key: i }, `⚠ ${w}`))
    ),
    errors.length > 0 && h('div', { className: 'kdna-trace-section kdna-errors' },
      h('h4', null, 'Errors'),
      errors.map((error, i) => h('div', { key: i }, `${error.code}: ${error.message}`))
    ),
    h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Provenance'),
      h('div', null, `Plan digest: ${trace.plan_ref?.plan_digest ?? 'not observed'}`),
      h('div', null, `Capsule delivery digest: ${trace.projection_actual?.capsule_delivery_digest ?? 'not delivered'}`)
    )
  );
}

// ── useTrace — pure data extractor for the current JudgmentTrace ───
// Despite the React-like name, this is a pure function (no hooks/state).
// This package-root implementation is the sole shipped runtime path.
export function useTrace(trace) {
  requireJudgmentTrace(trace);
  const primary = trace.asset_identity?.asset_id ?? null;
  const status = trace.overall_status ?? 'unknown';
  const tokensUsed = trace.budget?.actual?.tokens_used ?? null;
  const usageBasis = trace.budget?.actual?.usage_basis ?? 'not_observed';
  const isOverBudget = traceIsOverBudget(trace);
  const profile = trace.projection_actual?.profile ?? null;
  const profileDeviated = trace.projection_actual?.profile_deviated_from_plan ?? null;
  const resultDigest = traceResultDigest(trace);
  const resultStored = trace.result_ref?.stored ?? false;
  const warnings = trace.warnings ?? [];
  const errors = trace.errors ?? [];
  const hasIssues = warnings.length > 0 || errors.length > 0;
  const planDigest = trace.plan_ref?.plan_digest ?? null;
  const capsuleDeliveryDigest = trace.projection_actual?.capsule_delivery_digest ?? null;

  return {
    primary, status,
    deliveryStatus: trace.execution?.delivery_status ?? 'unknown',
    executionStatus: trace.execution?.execution_status ?? 'unknown',
    semanticConsumption: trace.execution?.semantic_consumption?.state ?? 'not_observed',
    conformanceStatus: trace.execution?.conformance_status ?? 'not_evaluated',
    modelIdentity: trace.execution?.model_identity?.value ?? null,
    modelIdentityBasis: trace.execution?.model_identity?.basis ?? 'not_observed',
    tokensUsed, usageBasis, isOverBudget,
    profile, profileDeviated,
    resultDigest, resultStored,
    warnings, errors, hasIssues, planDigest, capsuleDeliveryDigest,
  };
}
