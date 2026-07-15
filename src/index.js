import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
const JUDGMENT_TRACE_TYPE = 'kdna.judgment-trace';
const JUDGMENT_TRACE_CONTRACT_VERSION = '0.1.0';
const TRACE_ID = /^trace_[0-9a-f]{16}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const TOP_LEVEL_TRACE_FIELDS = new Set([
  'type', 'contract_version', 'trace_id', 'plan_ref', 'parent_trace_id', 'timestamp',
  'overall_status', 'runtime_contract', 'asset_identity', 'digest_evidence',
  'capsule_delivery_evidence', 'projection_actual', 'host_receipt', 'execution',
  'budget', 'result_ref', 'errors', 'warnings',
]);
const OVERALL_STATUSES = new Set([
  'execution_completed', 'blocked', 'execution_failed', 'cancelled', 'timed_out',
]);
const EXECUTION_STATUSES = new Set([
  'completed', 'not_started', 'failed', 'cancelled', 'timed_out',
]);

function hasObjectFields(value, path, fields, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(`${path}.${field} is required`);
  }
  return true;
}

function exactObject(value, path, fields, errors) {
  if (!hasObjectFields(value, path, fields, errors)) return false;
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) errors.push(`${path}.${field} is not part of the current contract`);
  }
  return true;
}

function validDigest(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function validateObservationLayers(execution, errors) {
  if (!exactObject(execution, 'execution', [
    'delivery_status', 'semantic_consumption', 'execution_status',
    'conformance_status', 'model_identity',
  ], errors)) return;
  if (!['correlated_response', 'rejected_before_execution', 'not_delivered'].includes(execution.delivery_status)) {
    errors.push('execution.delivery_status is invalid');
  }
  if (!EXECUTION_STATUSES.has(execution.execution_status)) errors.push('execution.execution_status is invalid');
  if (execution.conformance_status !== 'not_evaluated') errors.push('execution.conformance_status must be not_evaluated');
  if (exactObject(execution.semantic_consumption, 'execution.semantic_consumption', ['state', 'basis'], errors)
      && (execution.semantic_consumption.state !== 'not_observed' || execution.semantic_consumption.basis !== null)) {
    errors.push('execution.semantic_consumption cannot claim unobserved model behavior');
  }
  if (exactObject(execution.model_identity, 'execution.model_identity', ['value', 'basis'], errors)) {
    if (!['host_reported', 'not_observed'].includes(execution.model_identity.basis)) errors.push('execution.model_identity.basis is invalid');
    if (execution.model_identity.basis === 'not_observed' && execution.model_identity.value !== null) errors.push('execution.model_identity.value must be null when not observed');
    if (execution.model_identity.basis === 'host_reported' && (typeof execution.model_identity.value !== 'string' || execution.model_identity.value.length === 0)) errors.push('execution.model_identity.value must contain the host report');
  }
}

export function parseTrace(json) {
  const parsed = JSON.parse(json);
  const validation = validateTrace(parsed);
  if (!validation.valid) throw new Error(`Invalid JudgmentTrace: ${validation.errors.join('; ')}`);
  return parsed;
}

export function validateTrace(trace) {
  const errors = [];
  if (!trace || typeof trace !== 'object') return { valid: false, errors: ['trace must be an object'] };
  const t = trace;
  exactObject(t, 'trace', [...TOP_LEVEL_TRACE_FIELDS], errors);
  if (t.type !== JUDGMENT_TRACE_TYPE) errors.push(`type must be ${JUDGMENT_TRACE_TYPE}`);
  if (t.contract_version !== JUDGMENT_TRACE_CONTRACT_VERSION) errors.push(`contract_version must be ${JUDGMENT_TRACE_CONTRACT_VERSION}`);
  if (typeof t.trace_id !== 'string' || !TRACE_ID.test(t.trace_id)) errors.push('trace_id is invalid');
  if (t.parent_trace_id !== null && (typeof t.parent_trace_id !== 'string' || !TRACE_ID.test(t.parent_trace_id))) errors.push('parent_trace_id is invalid');
  if (typeof t.timestamp !== 'string' || !Number.isFinite(Date.parse(t.timestamp))) errors.push('timestamp is invalid');
  if (!OVERALL_STATUSES.has(t.overall_status)) errors.push('overall_status is invalid');

  if (exactObject(t.plan_ref, 'plan_ref', [
    'plan_id', 'plan_digest_profile', 'plan_digest_profile_version', 'plan_digest', 'comparison',
  ], errors)) {
    if (t.plan_ref.plan_digest_profile !== 'kdna.canonicalization.consumption-plan-jcs') errors.push('plan_ref.plan_digest_profile is invalid');
    if (t.plan_ref.plan_digest_profile_version !== JUDGMENT_TRACE_CONTRACT_VERSION) errors.push('plan_ref.plan_digest_profile_version is invalid');
    if (!validDigest(t.plan_ref.plan_digest)) errors.push('plan_ref.plan_digest is invalid');
    if (t.plan_ref.comparison !== 'matched') errors.push('plan_ref.comparison must be matched');
  }

  if (exactObject(t.runtime_contract, 'runtime_contract', [
    'plan_capsule_versions', 'core_capsule_versions', 'plan_host_protocols', 'host_capabilities',
    'negotiation_state', 'selected_capsule_version', 'selected_host_protocol', 'issue_code',
  ], errors)) {
    if (!Array.isArray(t.runtime_contract.plan_capsule_versions)
        || t.runtime_contract.plan_capsule_versions.some((version) => version !== JUDGMENT_TRACE_CONTRACT_VERSION)) errors.push('runtime_contract.plan_capsule_versions is invalid');
    if (!Array.isArray(t.runtime_contract.core_capsule_versions)
        || t.runtime_contract.core_capsule_versions.some((version) => version !== JUDGMENT_TRACE_CONTRACT_VERSION)) errors.push('runtime_contract.core_capsule_versions is invalid');
    if (!Array.isArray(t.runtime_contract.plan_host_protocols)
        || t.runtime_contract.plan_host_protocols.some((protocol) => protocol !== 'kdna.agent-host')) errors.push('runtime_contract.plan_host_protocols is invalid');
    if (!['selected', 'blocked', 'not_started'].includes(t.runtime_contract.negotiation_state)) errors.push('runtime_contract.negotiation_state is invalid');
  }

  if (exactObject(t.asset_identity, 'asset_identity', [
    'asset_id', 'asset_uid', 'version', 'judgment_version', 'access',
  ], errors)) {
    if (typeof t.asset_identity.asset_id !== 'string' || t.asset_identity.asset_id.length === 0) errors.push('asset_identity.asset_id is invalid');
    if (!['public', 'licensed', 'remote'].includes(t.asset_identity.access)) errors.push('asset_identity.access is invalid');
  }

  if (exactObject(t.digest_evidence, 'digest_evidence', [
    'profile', 'profile_version', 'asset', 'content', 'runtime_entry_set',
  ], errors)) {
    if (t.digest_evidence.profile !== 'kdna.digest-evidence') errors.push('digest_evidence.profile is invalid');
    if (t.digest_evidence.profile_version !== JUDGMENT_TRACE_CONTRACT_VERSION) errors.push('digest_evidence.profile_version is invalid');
    for (const key of ['asset', 'content', 'runtime_entry_set']) {
      if (!hasObjectFields(t.digest_evidence[key], `digest_evidence.${key}`, ['value', 'basis', 'comparison'], errors)
          || !validDigest(t.digest_evidence[key]?.value)) errors.push(`digest_evidence.${key}.value is invalid`);
    }
  }

  if (exactObject(t.capsule_delivery_evidence, 'capsule_delivery_evidence', [
    'basis', 'basis_version', 'observed', 'sender_computed', 'host_recomputed', 'host_echoed',
    'delivered_capsule_version', 'host_boundary_comparison', 'request_id',
  ], errors)) {
    if (t.capsule_delivery_evidence.basis !== 'kdna.canonicalization.runtime-capsule-jcs') errors.push('capsule_delivery_evidence.basis is invalid');
    if (t.capsule_delivery_evidence.basis_version !== JUDGMENT_TRACE_CONTRACT_VERSION) errors.push('capsule_delivery_evidence.basis_version is invalid');
    if (!['matched', 'mismatched', 'not_delivered', 'not_observed', 'unavailable'].includes(t.capsule_delivery_evidence.host_boundary_comparison)) errors.push('capsule_delivery_evidence.host_boundary_comparison is invalid');
  }

  if (exactObject(t.projection_actual, 'projection_actual', [
    'profile', 'capsule_delivery_digest', 'profile_deviated_from_plan',
  ], errors)) {
    if (![null, 'index', 'compact', 'scenario', 'full'].includes(t.projection_actual.profile)) errors.push('projection_actual.profile is invalid');
    if (t.projection_actual.capsule_delivery_digest !== null && !validDigest(t.projection_actual.capsule_delivery_digest)) errors.push('projection_actual.capsule_delivery_digest is invalid');
  }

  validateObservationLayers(t.execution, errors);

  if (exactObject(t.budget, 'budget', ['limits', 'actual', 'comparison'], errors)) {
    if (!hasObjectFields(t.budget.actual, 'budget.actual', [
      'projection_chars', 'task_chars', 'elapsed_ms', 'elapsed_basis', 'tokens_used', 'model_calls', 'usage_basis',
    ], errors)) errors.push('budget.actual is invalid');
    if (!hasObjectFields(t.budget.comparison, 'budget.comparison', [
      'projection_chars', 'task_chars', 'elapsed_ms', 'tokens_used', 'model_calls', 'overall',
    ], errors)) errors.push('budget.comparison is invalid');
    if (!['within_limit', 'exceeded', 'not_observed'].includes(t.budget.comparison?.overall)) errors.push('budget.comparison.overall is invalid');
  }

  if (t.result_ref !== null && exactObject(t.result_ref, 'result_ref', [
    'shape', 'result_digest', 'basis', 'stored',
  ], errors)) {
    if (t.result_ref.shape !== 'structured_judgment') errors.push('result_ref.shape is invalid');
    if (!validDigest(t.result_ref.result_digest)) errors.push('result_ref.result_digest is invalid');
    if (t.result_ref.basis !== 'kdna.canonicalization.result-jcs') errors.push('result_ref.basis is invalid');
  }
  if (t.host_receipt !== null && !hasObjectFields(t.host_receipt, 'host_receipt', [
    'protocol', 'protocol_version', 'request_id', 'runtime_receipt', 'outcome',
  ], errors)) errors.push('host_receipt is invalid');
  if (!Array.isArray(t.errors)) errors.push('errors must be an array');
  if (!Array.isArray(t.warnings) || t.warnings.some((warning) => typeof warning !== 'string')) errors.push('warnings must be an array of strings');

  if (t.overall_status === 'execution_completed') {
    if (t.execution?.delivery_status !== 'correlated_response') errors.push('completed execution requires correlated delivery');
    if (t.execution?.execution_status !== 'completed') errors.push('completed execution requires execution_status=completed');
    if (t.capsule_delivery_evidence?.host_boundary_comparison !== 'matched') errors.push('completed execution requires matched Host delivery evidence');
    if (t.result_ref === null) errors.push('completed execution requires result_ref');
  }
  return { valid: errors.length === 0, errors };
}

export function tracePrimaryLabel(trace) {
  return trace.asset_identity?.asset_id ?? 'none';
}

export function traceIsOverBudget(trace) {
  return trace.budget?.comparison?.overall === 'exceeded';
}

export function traceResultDigest(trace) {
  return trace.result_ref?.result_digest ?? null;
}

// ── KDNATraceViewer — renders the current JudgmentTrace ──────────
export function KDNATraceViewer({ trace, visible = false } = {}) {
  if (!visible || !trace) return null;

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
// Field set is synchronized with useTrace.ts — both return the same keys.
export function useTrace(trace) {
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
