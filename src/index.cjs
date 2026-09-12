"use strict";
const React = require('react');
const { selectKDNA, releaseKDNASelection, createKDNAWebClient } = require('@aikdna/kdna-web-client');
const { useCallback, useEffect, useId, useRef, useState } = React;
const h = React.createElement;
const initial = () => ({ phase: 'idle', selection: null, selectionResult: null, result: null, code: null });
const failed = code => ({ status: 'failed', code, admission: null, view: null });
const rejectedSelection = code => ({ status: 'rejected', code, selection: null });
function interrupt(owner) {
  owner.generation += 1;
  for (const controller of owner.reads) controller.abort();
}
function release(owner) {
  if (owner.selection) releaseKDNASelection(owner.selection);
  owner.selection = null;
  owner.selectionResult = null;
}
/** Each committed effect owns its client, selection and outstanding reads. */
function useKDNARead(options) {
  const { endpointUrl, endpointId, sessionId, timeoutMs, maxConcurrentRequests, fetch: fetcher, maxFileBytes } = options;
  const current = useRef(null);
  const [state, setState] = useState(initial);
  useEffect(() => {
    const owner = { alive: true, disposed: false, generation: 0, selection: null, selectionResult: null, reads: new Set(), client: null, maxFileBytes };
    current.current = owner;
    try {
      owner.client = createKDNAWebClient({ endpointUrl, endpointId, sessionId, timeoutMs, maxConcurrentRequests, fetch: fetcher });
      setState(initial());
    } catch {
      owner.disposed = true;
      setState({ ...initial(), phase: 'failed', code: 'REACT_CLIENT_OPTIONS_INVALID', result: failed('REACT_CLIENT_OPTIONS_INVALID') });
    }
    return () => {
      owner.alive = false;
      interrupt(owner);
      release(owner);
      owner.client?.dispose();
      if (current.current === owner) current.current = null;
    };
  }, [endpointUrl, endpointId, sessionId, timeoutMs, maxConcurrentRequests, fetcher, maxFileBytes]);
  const select = useCallback(async input => {
    const owner = current.current;
    if (!owner?.alive || owner.disposed) return rejectedSelection('REACT_DISPOSED');
    interrupt(owner);
    release(owner);
    const generation = owner.generation;
    setState({ ...initial(), phase: 'selecting' });
    let result;
    try { result = await selectKDNA(input, { maxFileBytes: owner.maxFileBytes }); }
    catch { result = rejectedSelection('REACT_SELECTION_FAILED'); }
    if (!owner.alive || owner.disposed || owner.generation !== generation || current.current !== owner) {
      if (result.status === 'selected') releaseKDNASelection(result.selection);
      return rejectedSelection('REACT_SELECTION_SUPERSEDED');
    }
    owner.selection = result.selection;
    owner.selectionResult = result;
    setState({ ...initial(), phase: result.status === 'selected' ? 'selected' : 'rejected', selection: result.selection, selectionResult: result, code: result.code });
    return result;
  }, []);
  const read = useCallback(async (context, settings = {}) => {
    const owner = current.current;
    if (!owner?.alive || owner.disposed) return failed('REACT_DISPOSED');
    if (!owner.selection) {
      const result = failed('REACT_SELECTION_REQUIRED');
      setState({ ...initial(), phase: 'failed', result, code: result.code });
      return result;
    }
    if (settings.signal !== undefined && !(settings.signal instanceof AbortSignal)) {
      return failed('CLIENT_SIGNAL_INVALID');
    }
    const selection = owner.selection, generation = ++owner.generation;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (settings.signal?.aborted) controller.abort();
    else settings.signal?.addEventListener('abort', abort, { once: true });
    owner.reads.add(controller);
    setState({ phase: 'reading', selection, selectionResult: owner.selectionResult, result: null, code: null });
    let result;
    try { result = await owner.client.read(selection, context, { signal: controller.signal }); }
    catch { result = failed('REACT_READ_FAILED'); }
    finally {
      settings.signal?.removeEventListener('abort', abort);
      owner.reads.delete(controller);
    }
    if (owner.alive && !owner.disposed && current.current === owner && owner.generation === generation && owner.selection === selection) {
      setState({ phase: result.status, selection, selectionResult: owner.selectionResult, result, code: result.code });
    }
    return result;
  }, []);
  const cancel = useCallback(() => {
    const owner = current.current;
    if (!owner?.alive || owner.disposed) return;
    interrupt(owner);
    setState({ phase: 'cancelled', selection: owner.selection, selectionResult: owner.selectionResult, result: null, code: 'CLIENT_CANCELLED' });
  }, []);
  const releaseSelection = useCallback(() => {
    const owner = current.current;
    if (!owner?.alive || owner.disposed) return;
    interrupt(owner); release(owner);
    setState({ ...initial(), phase: 'released' });
  }, []);
  const dispose = useCallback(() => {
    const owner = current.current;
    if (!owner?.alive || owner.disposed) return;
    interrupt(owner); release(owner); owner.disposed = true; owner.client?.dispose();
    setState({ ...initial(), phase: 'disposed' });
  }, []);
  return { ...state, select, read, cancel, release: releaseSelection, dispose };
}
/** Native file selection never performs a network read. */
function KDNAFileInput({ onSelect, label = 'Choose a KDNA file', disabled = false, className }) {
  const id = useId(), lifetime = useRef(0);
  const [error, setError] = useState(null);
  useEffect(() => { lifetime.current += 1; return () => { lifetime.current += 1; }; }, []);
  const change = event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || disabled) return;
    setError(null);
    const generation = ++lifetime.current;
    const fail = () => { if (lifetime.current === generation) setError('File selection could not be completed. Choose the file again.'); };
    try { Promise.resolve(onSelect(file)).catch(fail); } catch { fail(); }
  };
  return h('div', { className, style: { minWidth: 0, maxWidth: '100%' } },
    h('label', { htmlFor: id, style: { display: 'block' } }, label),
    h('input', { id, name: 'kdna-file', type: 'file', accept: '.kdna', disabled, onChange: change,
      'aria-describedby': error ? id + '-error' : undefined,
      style: { boxSizing: 'border-box', maxWidth: '100%', minHeight: 44, fontSize: 16, touchAction: 'manipulation' } }),
    error && h('p', { id: id + '-error', role: 'status', 'aria-live': 'polite' }, error));
}
function responseState(result) {
  if (!result || result.status !== 'received') return result?.status ?? 'not-disclosed';
  const response = result.view.response;
  if (response.channel === 'no_body_control') return 'no-body';
  if (response.channel === 'transport_failure') return 'failed';
  if (response.channel === 'admission_rejection' || response.body.status !== 'ready') return 'denied';
  return 'received';
}
function KDNAReadStatus({ state, className }) {
  const label = state.result ? responseState(state.result) : state.phase;
  return h('p', { className, role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
    `Read state: ${label}${state.code ? '; ' + state.code : ''}`);
}
function displayLimit(value, fallback, ceiling) {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > ceiling) throw new RangeError('REACT_DISPLAY_LIMIT_INVALID');
  return limit;
}
/** Presentation only. The public Web Client already owns all response admission. */
function KDNAReadView({ result, state, maxVisibleNodes, maxTextCharacters, className }) {
  if (state) result = state.result;
  const maximum = displayLimit(maxVisibleNodes, 20, 50), textLimit = displayLimit(maxTextCharacters, 4096, 16384);
  const text = value => {
    const valueText = typeof value === 'string' ? value : JSON.stringify(value);
    const s = valueText ?? 'Not disclosed';
    return s.length > textLimit ? s.slice(0, textLimit) + '… [display truncated]' : s;
  };
  const props = { className, 'aria-label': 'Remote read result', style: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } };
  if (!result) {
    const phases = {
      idle: 'No file selected. Choose a KDNA file to begin.',
      selecting: 'Checking the selected file. A read has not been requested.',
      selected: 'File selected. A read has not been requested.',
      reading: 'Read in progress. No response has been received for this request.',
      rejected: 'File selection was not accepted.',
      failed: 'No read response is available.',
      cancelled: state?.selection ? 'Read cancelled. The file selection is still available.' : 'Operation cancelled. No file is selected.',
      released: 'File selection released.',
      disposed: 'Reader closed.'
    };
    const rejection = state?.phase === 'rejected' && state.selectionResult?.status === 'rejected' ? state.selectionResult : null;
    return h('section', props,
      h('p', null, state ? (Object.hasOwn(phases, state.phase) ? phases[state.phase] : 'No read response is available.') : 'No remote response received. Select a file, then request a read.'),
      state?.code && h('p', null, text(state.code)),
      rejection?.states && h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, text(rejection.states)),
      rejection?.diagnostics && h('div', null, h('h3', null, 'Selection diagnostics'),
        ...rejection.diagnostics.slice(0, maximum).map((diagnostic, i) => h('pre', { key: i, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, text(diagnostic))),
        rejection.diagnostics.length > maximum && h('p', null, `${rejection.diagnostics.length - maximum} additional diagnostics not displayed.`)),
      rejection?.component_failure && h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, text(rejection.component_failure)));
  }
  if (result.status !== 'received') return h('section', props, h('p', null, result.code), h('p', null, 'Content not disclosed. A new read requires caller-supplied context.'));
  const view = result.view, response = view.response;
  const ready = response.channel === 'read_envelope' && response.body.status === 'ready';
  const list = (label, values) => h('div', { key: label }, h('h3', null, label),
    h('ul', { 'aria-label': label }, values.slice(0, maximum).map((v, i) => h('li', { key: i },
      h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0.5em 0' } }, text(v))))),
    values.length > maximum && h('p', null, `${values.length - maximum} additional disclosed items not displayed.`));
  return h('section', props,
    h('h2', null, 'Remote read response'),
    h('p', null, `Response: ${responseState(result)}; channel: ${response.channel}; HTTP ${response.http_status}`),
    response.headers?.code && h('p', null, response.headers.code),
    response.body?.diagnostic && h('p', null, text(response.body.diagnostic)),
    response.body?.diagnostics && list('Diagnostics', response.body.diagnostics),
    ready ? h(React.Fragment, null,
      h('p', null, `Asset: ${text(response.body.asset.asset_id)}`),
      list('Catalog', response.body.content.catalog), list('Disclosed nodes', response.body.content.closure), list('Omissions', response.body.omissions))
      : h('p', null, 'Content not disclosed.'),
    h('p', null, 'Cross-request expansion is unsupported (NOT_PROVEN).'),
    h('p', null, 'Remote response; no local authorization or action capability.'),
    h('h3', null, 'Proof limits'),
    h('dl', { 'aria-label': 'Proof limits' }, Object.entries(view.proof_limits).map(([key, value]) =>
      h(React.Fragment, { key }, h('dt', null, key), h('dd', null, text(value))))));
}
module.exports = { useKDNARead, KDNAFileInput, KDNAReadStatus, KDNAReadView };
