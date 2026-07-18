import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KDNAFileSizeError,
  KDNALoadPlanManager,
  uploadKDNA,
} from '@aikdna/kdna-web-client';
import {
  KDNA_SCHEMA_AUTHORITY,
  validateJudgmentTrace as validateCanonicalJudgmentTrace,
} from './generated/runtime-validators.js';

export { KDNA_SCHEMA_AUTHORITY };

const h = React.createElement;
const MACHINE_FINGERPRINT = /^[0-9a-f]{64}$/u;
const LICENSE_ID = /^[A-Za-z0-9_\-:.]{1,128}$/u;
const SIGNATURE_BASE64 = /^[A-Za-z0-9+/]{86}==$/u;
const ENTITLEMENT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/u;
const RAW_SECRET_CONTEXT_KEYS = new Set([
  'password', 'passphrase', 'secret', 'clientsecret',
  'licensekey', 'apikey', 'authorization', 'cookie',
  'accesstoken', 'refreshtoken',
]);
const ACTIVATION_FIELDS = Object.freeze([
  'version',
  'license_id',
  'domain',
  'issued_to',
  'issued_at',
  'expires_at',
  'status',
  'revoked',
  'revoked_at',
  'revocation_reason',
  'require_machine_binding',
  'require_online_check',
  'offline_grace_days',
  'allowed_agents',
  'last_checked_at',
  'offline_valid_until',
  'updated_at',
  'machine_fingerprint',
  'signature_base64',
]);

export class KDNAActivationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'KDNAActivationError';
    this.code = options.code || 'KDNA_ACTIVATION_ERROR';
    this.status = options.status ?? null;
    this.response = null;
  }
}

function activationError(code, message) {
  return new KDNAActivationError(message, { code });
}

function activationRequest({ domain, licenseKey, machineFingerprint, client }) {
  if (typeof domain !== 'string' || domain.length === 0 || domain.length > 512) {
    throw activationError(
      'KDNA_ACTIVATION_INVALID_DOMAIN',
      'Activation requires an asset ID; the server validates it against KDNA Core.',
    );
  }
  if (typeof licenseKey !== 'string' || licenseKey.length === 0) {
    throw activationError('KDNA_ACTIVATION_LICENSE_REQUIRED', 'A license key is required.');
  }
  if (machineFingerprint != null && !MACHINE_FINGERPRINT.test(machineFingerprint)) {
    throw activationError(
      'KDNA_ACTIVATION_INVALID_MACHINE',
      'The machine fingerprint must be a lowercase SHA-256 digest.',
    );
  }
  if (client != null && (typeof client !== 'string' || client.length === 0 || client.length > 128)) {
    throw activationError('KDNA_ACTIVATION_INVALID_CLIENT', 'The activation client is invalid.');
  }
  return {
    domain,
    license_key: licenseKey,
    ...(machineFingerprint == null ? {} : { machine_fingerprint: machineFingerprint }),
    ...(client == null ? {} : { client }),
  };
}

function boundedString(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function nullableBoundedString(value, maxLength) {
  return value === null || boundedString(value, maxLength);
}

function isoTimestamp(value, nullable = false) {
  if (nullable && value === null) return true;
  return boundedString(value, 64)
    && /^\d{4}-\d{2}-\d{2}T/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function boundedAgents(value) {
  return value === null || (
    Array.isArray(value)
    && value.length <= 128
    && value.every((agent) => boundedString(agent, 256))
  );
}

function publicActivation(payload, request) {
  const now = Date.now();
  if (
    !payload || typeof payload !== 'object' || Array.isArray(payload)
    || !ENTITLEMENT_VERSION.test(payload.version)
    || !LICENSE_ID.test(payload.license_id)
    || payload.domain !== request.domain
    || !nullableBoundedString(payload.issued_to, 512)
    || !isoTimestamp(payload.issued_at)
    || !isoTimestamp(payload.expires_at, true)
    || (payload.expires_at !== null && Date.parse(payload.expires_at) <= now)
    || payload.status !== 'active'
    || payload.revoked !== false
    || payload.revoked_at !== null
    || payload.revocation_reason !== null
    || typeof payload.require_machine_binding !== 'boolean'
    || typeof payload.require_online_check !== 'boolean'
    || !Number.isInteger(payload.offline_grace_days)
    || payload.offline_grace_days < 0
    || payload.offline_grace_days > 3650
    || !boundedAgents(payload.allowed_agents)
    || !isoTimestamp(payload.last_checked_at)
    || !isoTimestamp(payload.offline_valid_until)
    || (payload.require_online_check === true && Date.parse(payload.offline_valid_until) <= now)
    || !isoTimestamp(payload.updated_at)
    || !SIGNATURE_BASE64.test(payload.signature_base64)
    || (payload.require_machine_binding === true && (
      request.machine_fingerprint == null
      || payload.machine_fingerprint !== request.machine_fingerprint
    ))
    || (payload.require_machine_binding === false && payload.machine_fingerprint != null)
  ) {
    throw activationError(
      'KDNA_ACTIVATION_RESPONSE_INVALID',
      'The activation endpoint returned an invalid entitlement.',
    );
  }
  return Object.fromEntries(
    ACTIVATION_FIELDS
      .filter((field) => Object.hasOwn(payload, field))
      .map((field) => [field, payload[field]]),
  );
}

function endpoint(base, path) {
  return `${String(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function defaultErrorHandler() {}

function canonicalLoadContext(input) {
  const seen = new Set();
  const normalize = (value) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) {
      if (seen.has(value)) throw new TypeError('LoadPlan context must not contain cycles.');
      seen.add(value);
      const output = value.map(normalize);
      seen.delete(value);
      return output;
    }
    if (value && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('LoadPlan context must contain JSON values only.');
      }
      if (seen.has(value)) throw new TypeError('LoadPlan context must not contain cycles.');
      seen.add(value);
      const output = Object.fromEntries(
        Object.keys(value).sort().map((key) => {
          const normalizedKey = key.replace(/[_-]/gu, '').toLowerCase();
          if (RAW_SECRET_CONTEXT_KEYS.has(normalizedKey)) {
            throw new TypeError('LoadPlan context must not contain credentials.');
          }
          return [key, normalize(value[key])];
        }),
      );
      seen.delete(value);
      return output;
    }
    throw new TypeError('LoadPlan context must contain JSON values only.');
  };

  const value = normalize(input ?? {});
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError('LoadPlan context must be a JSON object.');
  }
  return { key: JSON.stringify(value), value };
}

export function useKDNALoadPlan({ endpoint: baseUrl, fileId, context, enabled = true } = {}) {
  const manager = useMemo(() => new KDNALoadPlanManager(baseUrl), [baseUrl]);
  let candidate;
  try {
    candidate = { ...canonicalLoadContext(context), error: null };
  } catch {
    candidate = {
      key: 'invalid-load-context',
      value: null,
      error: new TypeError(
        'LoadPlan context must be a finite, credential-free JSON object without cycles.',
      ),
    };
  }
  const stableContext = useRef(null);
  if (stableContext.current?.key !== candidate.key) {
    stableContext.current = { ...candidate, token: {} };
  }
  const contextSnapshot = stableContext.current;
  const contextToken = contextSnapshot.token;
  const requestSequence = useRef(0);
  const currentRequest = useRef({ contextToken, enabled, fileId, manager });
  currentRequest.current = { contextToken, enabled, fileId, manager };
  const [state, setState] = useState({
    contextToken,
    enabled,
    fileId,
    manager,
    status: fileId ? 'checking' : 'idle',
    plan: null,
    missing: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    const initial = currentRequest.current;
    if (initial.contextToken !== contextToken
      || initial.enabled !== enabled
      || initial.fileId !== fileId
      || initial.manager !== manager) return null;
    const requestId = ++requestSequence.current;
    const isCurrent = () => {
      const current = currentRequest.current;
      return requestId === requestSequence.current
        && current.contextToken === contextToken
        && current.enabled === enabled
        && current.fileId === fileId
        && current.manager === manager;
    };
    if (!fileId || !enabled) {
      if (isCurrent()) {
        setState({
          contextToken, enabled, fileId, manager,
          status: 'idle', plan: null, missing: [], error: null,
        });
      }
      return null;
    }

    setState({
      contextToken, enabled, fileId, manager,
      status: 'checking', plan: null, missing: [], error: null,
    });
    if (contextSnapshot.error) {
      const next = {
        contextToken, enabled, fileId, manager,
        status: 'error', plan: null, missing: [], error: contextSnapshot.error,
      };
      if (isCurrent()) setState(next);
      return isCurrent() ? next : null;
    }
    try {
      const response = await manager.planLoad(fileId, contextSnapshot.value);
      const next = {
        contextToken,
        enabled,
        fileId,
        manager,
        status: response.canProceed ? 'ready' : 'locked',
        plan: response.plan,
        missing: response.missing,
        error: null,
      };
      if (isCurrent()) {
        setState(next);
        return next;
      }
      return null;
    } catch (error) {
      const next = {
        contextToken, enabled, fileId, manager,
        status: 'error', plan: null, missing: [], error,
      };
      if (isCurrent()) {
        setState(next);
        return next;
      }
      return null;
    }
  }, [contextSnapshot, contextToken, enabled, fileId, manager]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = state.contextToken === contextToken
    && state.enabled === enabled
    && state.fileId === fileId
    && state.manager === manager
    ? state
    : {
        status: fileId && enabled ? 'checking' : 'idle',
        plan: null,
        missing: [],
        error: null,
      };
  return {
    status: visible.status,
    plan: visible.plan,
    missing: visible.missing,
    error: visible.error,
    refresh,
  };
}

export function useKDNA({ endpoint: baseUrl, fileId, profile = 'compact' } = {}) {
  const manager = useMemo(() => new KDNALoadPlanManager(baseUrl), [baseUrl]);
  const plan = useKDNALoadPlan({ endpoint: baseUrl, fileId });
  const loadKey = `${String(baseUrl || '')}\u0000${String(fileId || '')}\u0000${profile}`;
  const currentLoadKey = useRef(loadKey);
  currentLoadKey.current = loadKey;
  const loadSequence = useRef(0);
  const [loadState, setLoadState] = useState({
    key: loadKey,
    content: null,
    loading: false,
    error: null,
  });

  const load = useCallback(async (options = {}) => {
    if (!fileId) return null;
    if (currentLoadKey.current !== loadKey) return null;
    const requestId = ++loadSequence.current;
    const isCurrent = () => requestId === loadSequence.current
      && currentLoadKey.current === loadKey;
    setLoadState({ key: loadKey, content: null, loading: true, error: null });
    try {
      const result = await manager.load(fileId, { profile, ...options });
      if (isCurrent()) {
        setLoadState({ key: loadKey, content: result.content, loading: false, error: null });
      }
      return isCurrent() ? result : null;
    } catch (loadError) {
      if (isCurrent()) {
        setLoadState({ key: loadKey, content: null, loading: false, error: loadError });
      }
      throw loadError;
    } finally {
      if (isCurrent()) {
        setLoadState((current) => ({ ...current, loading: false }));
      }
    }
  }, [fileId, loadKey, manager, profile]);

  const current = loadState.key === loadKey
    ? loadState
    : { content: null, loading: false, error: null };
  return {
    ...plan,
    status: current.error ? 'error' : plan.status,
    content: current.content,
    loading: current.loading,
    error: current.error || plan.error,
    load,
  };
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
  const uploadIdentity = JSON.stringify([baseUrl ?? null, disabled, maxSizeBytes]);
  const currentUploadIdentity = useRef(uploadIdentity);
  currentUploadIdentity.current = uploadIdentity;
  const uploadSequence = useRef(0);
  const emptyUploadState = () => ({
    identity: uploadIdentity,
    file: null,
    fileId: null,
    inspect: null,
    loading: false,
    error: null,
  });
  const [state, setState] = useState(emptyUploadState);
  const visible = state.identity === uploadIdentity ? state : emptyUploadState();

  useEffect(() => {
    uploadSequence.current += 1;
    setState(emptyUploadState());
    if (inputRef.current) inputRef.current.value = '';
  }, [uploadIdentity]);

  const reset = useCallback(() => {
    uploadSequence.current += 1;
    setState(emptyUploadState());
    if (inputRef.current) inputRef.current.value = '';
  }, [uploadIdentity]);

  const upload = useCallback(async (file) => {
    if (disabled) return;
    if (!file) return;
    if (currentUploadIdentity.current !== uploadIdentity) return;
    const requestId = ++uploadSequence.current;
    const isCurrent = () => requestId === uploadSequence.current
      && currentUploadIdentity.current === uploadIdentity;
    if (file.size > maxSizeBytes) {
      const error = new KDNAFileSizeError(
        `KDNA file exceeds maxSizeBytes (${maxSizeBytes}).`,
        { maxSizeBytes, actualSizeBytes: file.size },
      );
      setState({
        identity: uploadIdentity,
        file, fileId: null, inspect: null, loading: false, error,
      });
      onError(error);
      return;
    }

    setState({
      identity: uploadIdentity,
      file, fileId: null, inspect: null, loading: true, error: null,
    });
    try {
      const { fileId, inspect } = await uploadKDNA(file, endpoint(baseUrl, 'inspect'));
      if (isCurrent()) {
        setState({
          identity: uploadIdentity,
          file, fileId, inspect, loading: false, error: null,
        });
      }
    } catch (error) {
      if (isCurrent()) {
        setState({
          identity: uploadIdentity,
          file, fileId: null, inspect: null, loading: false, error,
        });
        onError(error);
      }
    }
  }, [baseUrl, disabled, maxSizeBytes, onError, uploadIdentity]);

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
    typeof children === 'function' ? children({
      file: visible.file,
      fileId: visible.fileId,
      inspect: visible.inspect,
      loading: visible.loading,
      error: visible.error,
      reset,
    }) : children);
}

export function KDNALoadPlanGate({ fileId, endpoint: baseUrl, profile = 'compact', children }) {
  const kdna = useKDNA({ endpoint: baseUrl, fileId, profile });
  const { status, content, loading, load } = kdna;

  useEffect(() => {
    if (status === 'ready' && !content && !loading && !kdna.error) {
      load().catch(() => {});
    }
  }, [content, kdna.error, load, loading, status]);

  const childState = {
    status: kdna.content ? 'loaded' : (kdna.error ? 'error' : kdna.status),
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
  const manager = useMemo(() => new KDNALoadPlanManager(baseUrl), [baseUrl]);
  const identity = JSON.stringify([baseUrl ?? null, fileId ?? null, profile]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const [state, setState] = useState({ identity, password: '', error: null, loading: false });
  const visible = state.identity === identity
    ? state
    : { identity, password: '', error: null, loading: false };

  useEffect(() => {
    requestSequence.current += 1;
    setState({ identity, password: '', error: null, loading: false });
  }, [identity]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!mounted.current || currentIdentity.current !== identity) return null;
    const requestId = ++requestSequence.current;
    const submittedPassword = visible.password;
    const isCurrent = () => mounted.current
      && requestId === requestSequence.current
      && currentIdentity.current === identity;
    setState({ identity, password: '', error: null, loading: true });
    let result;
    try {
      result = await manager.load(fileId, { profile, password: submittedPassword });
    } catch (unlockError) {
      if (isCurrent()) {
        setState({ identity, password: '', error: unlockError, loading: false });
        onError?.(unlockError);
      }
      return null;
    }
    if (!isCurrent()) return null;
    setState({ identity, password: '', error: null, loading: false });
    onUnlock?.(result);
    return result;
  }

  function cancel() {
    if (!mounted.current || currentIdentity.current !== identity) return;
    requestSequence.current += 1;
    setState({ identity, password: '', error: null, loading: false });
    onCancel?.();
  }

  return h('form', { role: 'dialog', 'aria-modal': 'true', onSubmit: submit },
    title ? h('h2', null, title) : null,
    h('label', null, 'Password',
      h('input', {
        type: 'password',
        value: visible.password,
        required: true,
        disabled: visible.loading,
        onChange: (event) => setState({
          identity, password: event.target.value, error: null, loading: false,
        }),
        autoComplete: 'current-password',
      })),
    hint ? h('p', null, hint) : null,
    visible.error ? h('p', { role: 'alert' }, visible.error.message) : null,
    h('button', { type: 'submit', disabled: visible.loading }, visible.loading ? 'Unlocking...' : 'Unlock'),
    h('button', { type: 'button', onClick: cancel, disabled: visible.loading }, 'Cancel'));
}

export function KDNALicenseActivationForm({
  domain,
  endpoint: baseUrl,
  machineFingerprint,
  client,
  onActivated,
  onError,
  label = 'License key',
  submitLabel = 'Activate',
}) {
  const manager = useMemo(() => new KDNALoadPlanManager(baseUrl), [baseUrl]);
  const identity = JSON.stringify([
    baseUrl ?? null, domain ?? null, machineFingerprint ?? null, client ?? null,
  ]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const [state, setState] = useState({ identity, licenseKey: '', error: null, loading: false });
  const visible = state.identity === identity
    ? state
    : { identity, licenseKey: '', error: null, loading: false };

  useEffect(() => {
    requestSequence.current += 1;
    setState({ identity, licenseKey: '', error: null, loading: false });
  }, [identity]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!mounted.current || currentIdentity.current !== identity) return null;
    const requestId = ++requestSequence.current;
    const submittedLicenseKey = visible.licenseKey;
    const isCurrent = () => mounted.current
      && requestId === requestSequence.current
      && currentIdentity.current === identity;
    setState({ identity, licenseKey: '', error: null, loading: true });
    let entitlement;
    try {
      const request = activationRequest({
        domain,
        licenseKey: submittedLicenseKey,
        machineFingerprint,
        client,
      });
      const result = await manager.post('activate', request);
      entitlement = publicActivation(result, request);
    } catch (activationError) {
      if (isCurrent()) {
        setState({ identity, licenseKey: '', error: activationError, loading: false });
        onError?.(activationError);
      }
      return null;
    }
    if (!isCurrent()) return null;
    setState({ identity, licenseKey: '', error: null, loading: false });
    onActivated?.(entitlement);
    return entitlement;
  }

  return h('form', { onSubmit: submit },
    h('label', null, label,
      h('input', {
        type: 'password',
        value: visible.licenseKey,
        required: true,
        disabled: visible.loading,
        onChange: (event) => setState({
          identity, licenseKey: event.target.value, error: null, loading: false,
        }),
        autoComplete: 'one-time-code',
        autoCapitalize: 'none',
        spellCheck: false,
      })),
    visible.error ? h('p', { role: 'alert' }, visible.error.message) : null,
    h('button', { type: 'submit', disabled: visible.loading }, visible.loading ? 'Activating...' : submitLabel));
}

export function KDNAAssetInspector({
  inspect,
  showProfiles = true,
  showLoadPlan = true,
  className,
}) {
  if (!inspect) return null;
  const domain = inspect.domain || '';
  const title = inspect.title || inspect.domain || 'KDNA asset';
  const version = inspect.version || '';
  const description = inspect.description || '';
  const profiles = Array.isArray(inspect.profiles) ? inspect.profiles : [];
  const defaultProfile = inspect.defaultProfile || null;
  const encrypted = inspect.encrypted === true;
  const loadPlan = inspect.loadPlan || null;
  const loadPlanMode = loadPlan?.state || loadPlan?.required_action || null;
  const requiredAction = loadPlan?.required_action;
  const requirements = requiredAction && !['none', 'load'].includes(requiredAction)
    ? [requiredAction]
    : [];

  return h('section', { className },
    h('h2', null, title),
    domain ? h('p', null, `Domain: ${domain}`) : null,
    version ? h('p', null, version) : null,
    description ? h('p', null, description) : null,
    h('p', null, encrypted ? 'Encrypted' : 'Open'),
    showLoadPlan && loadPlanMode ? h('p', null, `Load plan: ${loadPlanMode}`) : null,
    showLoadPlan && requirements.length
      ? h('ul', null, requirements.map((requirement) => h('li', { key: requirement }, requirement)))
      : null,
    showProfiles && defaultProfile ? h('p', null, `Default profile: ${defaultProfile}`) : null,
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
  const modelReported = trace.execution?.model_identity?.basis === 'host_reported';

  return h('div', { className: 'kdna-trace-viewer' },
    h('h3', null, `JudgmentTrace: ${trace.trace_id}`),
    h('div', { className: 'kdna-trace-operation' },
      `Status: ${status}${modelReported ? ' | Model identity: host reported' : ''}`
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
      h('div', null, `${warnings.length} warning item${warnings.length === 1 ? '' : 's'} hidden`)
    ),
    errors.length > 0 && h('div', { className: 'kdna-trace-section kdna-errors' },
      h('h4', null, 'Errors'),
      errors.map((error, i) => h('div', { key: i },
        `${/^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code) ? error.code : 'KDNA_TRACE_ERROR'}: ${error.phase}`))
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
