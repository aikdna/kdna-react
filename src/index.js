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
const TRACE_VERSION = '0.9.0';
const KNOWN_EXECUTION_STATUSES = new Set(['completed', 'blocked', 'cancelled', 'timed_out', 'runner_error', 'partial']);

export function parseTrace(json) {
  const parsed = JSON.parse(json);
  const version = parsed.trace_version;
  if (!version) throw new Error('Unknown trace format: missing trace_version');
  if (version !== TRACE_VERSION) throw new Error(`Unknown trace version: ${version}. Expected ${TRACE_VERSION}.`);
  const validation = validateTrace(parsed);
  if (!validation.valid) throw new Error(`Invalid JudgmentTrace: ${validation.errors.join('; ')}`);
  return parsed;
}

export function validateTrace(trace) {
  const errors = [];
  if (!trace || typeof trace !== 'object') return { valid: false, errors: ['trace must be an object'] };
  const t = trace;
  const version = t.trace_version;
  if (!version) errors.push('trace must have trace_version');
  else if (version !== TRACE_VERSION) errors.push(`unknown trace_version: "${version}" — expected ${TRACE_VERSION}`);
  if (typeof t.trace_id !== 'string' || t.trace_id.length < 16) errors.push('trace_id must be a string');
  if (typeof t.plan_id !== 'string') errors.push('plan_id is required');
  if (t.mode !== 'single' && t.mode !== 'cluster') errors.push('mode must be single or cluster');
  if (typeof t.timestamp !== 'string') errors.push('timestamp is required');
  if (!t.execution || typeof t.execution !== 'object') errors.push('execution is required');
  if (t.execution && typeof t.execution === 'object' && t.execution.status && !KNOWN_EXECUTION_STATUSES.has(t.execution.status)) {
    errors.push(`unknown execution status: "${t.execution.status}" — expected: ${[...KNOWN_EXECUTION_STATUSES].join(', ')}`);
  }
  if (t.mode === 'single' && (!t.asset_identity || typeof t.asset_identity !== 'object')) errors.push('asset_identity is required for single mode');
  if (t.mode === 'cluster') {
    if (!t.cluster_identity || typeof t.cluster_identity !== 'object') errors.push('cluster_identity is required for cluster mode');
    if (!Array.isArray(t.assets_loaded)) errors.push('assets_loaded is required for cluster mode');
    if (!t.selection_actual || typeof t.selection_actual !== 'object') errors.push('selection_actual is required for cluster mode');
  }
  if (t.execution?.status === 'completed' && (!t.result_ref || typeof t.result_ref !== 'object')) errors.push('result_ref is required when execution completed');
  return { valid: errors.length === 0, errors };
}

export function tracePrimaryLabel(trace) {
  if (trace.asset_identity?.asset_id) return trace.asset_identity.asset_id;
  if (trace.assets_loaded?.length) {
    const primary = trace.assets_loaded.find(a => a.role === 'primary');
    if (primary) return primary.asset_id;
  }
  if (trace.selection_actual?.primary) return trace.selection_actual.primary;
  return 'none';
}

export function traceIsOverBudget(trace) {
  return trace.cost?.over_budget ?? false;
}

export function traceAnswerSummary(trace) {
  return trace.result_ref?.answer_summary ?? '';
}

// ── KDNATraceViewer — renders the current JudgmentTrace ──────────
export function KDNATraceViewer({ trace, visible = false } = {}) {
  if (!visible || !trace) return null;

  const primary = tracePrimaryLabel(trace);
  const isCluster = trace.mode === 'cluster';

  const advisors09 = trace.assets_loaded?.filter(a => a.role === 'advisor') ?? [];
  const advisors = isCluster ? advisors09.map(a => ({ domain_id: a.asset_id, weight: a.weight, hypothesis: a.contribution_hypothesis })) : [];

  const status = trace.execution?.status ?? 'unknown';
  const answer = traceAnswerSummary(trace);
  const overBudget = traceIsOverBudget(trace);
  const selfChecks = trace.evaluation?.self_checks ?? [];
  const warnings = trace.warnings ?? [];
  const provenance = trace.provenance;

  return h('div', { className: 'kdna-trace-viewer' },
    h('h3', null, `Trace: ${trace.trace_id}`),
    h('div', { className: 'kdna-trace-operation' },
      `Mode: ${trace.mode ?? 'single'} | Status: ${status}${trace.execution?.model ? ` | Model: ${trace.execution.model}` : ''}`
    ),
    h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Primary'),
      primary ? h('div', null, primary) : h('div', { className: 'kdna-empty' }, 'No primary resolved')
    ),
    advisors.length > 0 && h('div', { className: 'kdna-trace-section' },
      h('h4', null, `Advisors (${advisors.length})`),
      h('ul', null, advisors.map((a, i) =>
        h('li', { key: i }, `${a.domain_id}${a.weight !== undefined ? ` (w: ${a.weight})` : ''}${a.hypothesis ? ` — ${a.hypothesis.slice(0, 80)}${a.hypothesis.length > 80 ? '...' : ''}` : ''}`)
      ))
    ),
    answer && h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Result'), h('div', null, answer)
    ),
    overBudget && h('div', { className: 'kdna-trace-section kdna-over-budget' },
      h('h4', null, 'Budget'), 'Over budget'
    ),
    selfChecks.length > 0 && h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Self-Checks'),
      selfChecks.map((c, i) =>
        h('div', { key: i, className: c.passed ? 'kdna-check-pass' : 'kdna-check-fail' },
          `${c.passed ? '✓' : '✗'} ${c.check_id}`
        )
      )
    ),
    warnings.length > 0 && h('div', { className: 'kdna-trace-section kdna-warnings' },
      h('h4', null, 'Warnings'),
      warnings.map((w, i) => h('div', { key: i }, `⚠ ${w}`))
    ),
    provenance && h('div', { className: 'kdna-trace-section' },
      h('h4', null, 'Provenance'),
      provenance.plan_digest && h('div', null, `Plan digest: ${provenance.plan_digest.slice(0, 20)}...`)
    )
  );
}

// ── useTrace — pure data extractor for the current JudgmentTrace ───
// Despite the React-like name, this is a pure function (no hooks/state).
// Field set is synchronized with useTrace.ts — both return the same keys.
export function useTrace(trace) {
  const isCluster = trace.mode === 'cluster';

  const primary = isCluster
    ? (trace.assets_loaded?.find(a => a.role === 'primary')?.asset_id ??
       trace.selection_actual?.primary ?? null)
    : (trace.asset_identity?.asset_id ?? null);

  const advisors = isCluster
    ? (trace.assets_loaded
        ?.filter(a => a.role === 'advisor')
        .map(a => ({
          asset_id: a.asset_id,
          weight: a.weight,
          contribution_fulfilled: a.contribution_fulfilled,
          contribution_hypothesis: a.contribution_hypothesis,
        })) ?? [])
    : [];

  const rejected = trace.selection_actual?.rejected?.map(r => ({
    asset_id: r.asset_id,
    reason: r.reason ?? 'unknown',
  })) ?? [];

  const confidence = trace.applicability_actual?.confidence ?? 'unknown';

  const status = trace.execution?.status ?? 'unknown';

  const tokensUsed = trace.cost?.tokens_used ?? 0;
  const isOverBudget = trace.cost?.over_budget ?? false;
  const overBudgetReason = trace.cost?.over_budget_reason ?? null;

  const shape = trace.projection_actual?.shape ?? 'answer-pattern';
  const shapeDeviated = trace.projection_actual?.shape_deviated_from_plan ?? false;

  const answerSummary = trace.result_ref?.answer_summary ?? '';
  const hasResult = trace.result_ref?.result_stored ?? false;

  const selfChecks = trace.evaluation?.self_checks ?? [];
  const selfChecksPassed = selfChecks.filter(c => c.passed).length;
  const selfChecksTotal = selfChecks.length;
  const violations = trace.evaluation?.violations ?? [];
  const bannedTerms = trace.evaluation?.banned_terms_detected ?? [];

  const warnings = trace.warnings ?? [];
  const errors = trace.errors ?? [];
  const hasIssues = warnings.length > 0 || errors.length > 0;

  const attribution = trace.source_attribution?.map(a => ({
    asset_id: a.asset_id,
    axiomsTriggered: a.axioms_triggered,
    operationalized: a.transfer_depth?.operationalized ?? 0,
    referenced: a.transfer_depth?.referenced ?? 0,
    mentioned: a.transfer_depth?.mentioned ?? 0,
  })) ?? [];

  const planDigest = trace.provenance?.plan_digest ?? null;
  const clusterDigest = trace.provenance?.cluster_manifest_digest ?? null;

  return {
    primary, advisors, rejected, confidence, status,
    tokensUsed, isOverBudget, overBudgetReason, shape, shapeDeviated,
    answerSummary, hasResult,
    selfChecksPassed, selfChecksTotal, violations, bannedTerms,
    warnings, errors, hasIssues,
    attribution, planDigest, clusterDigest, isCluster,
    mode: trace.mode ?? 'single',
  };
}
