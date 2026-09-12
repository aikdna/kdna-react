# @aikdna/kdna-react

This candidate consumes the public Web Client 0.5.0-rc.component-semantics.1 contract. It provides `useKDNARead`, `KDNAFileInput`, `KDNAReadStatus` and `KDNAReadView` through the package root in ESM and CJS. Types are included. Verification targets React 18.3.1; the declared React/ReactDOM peer range remains >=18 <20. Other peer versions require their own verification.

```tsx
import { KDNAFileInput, KDNAReadStatus, KDNAReadView, useKDNARead } from '@aikdna/kdna-react';
import type { ReadTransportContext } from '@aikdna/kdna-react';

export function RemoteRead({ context }: { context: ReadTransportContext }) {
  const reader = useKDNARead({ endpointUrl: context.endpoint_url,
    endpointId: context.endpoint_id, sessionId: context.session_id });
  return <section>
    <KDNAFileInput onSelect={reader.select} disabled={reader.phase === 'disposed'} />
    <button type="button" disabled={!reader.selection} onClick={() => reader.read(context)}>Read</button>
    <button type="button" onClick={reader.cancel}>Cancel</button>
    <button type="button" onClick={reader.release}>Release selection</button>
    <KDNAReadStatus state={reader} />
    <KDNAReadView state={reader} />
  </section>;
}
```

The embedding caller must supply a fresh valid `ReadTransportContext` matching the chosen selection, endpoint and session. This example does not create context, grants, remote authority or handles. Selecting a file never sends it. The application must request a read explicitly and obtain new context for each new request; reusing a context can fail public replay admission.

`select` accepts File, Blob, ArrayBuffer or Uint8Array and delegates byte limits and technical admission to Web Client. Replacing or releasing a selection cancels its reads. `cancel` cancels pending selection publication and outstanding reads, preserving any current selection. `dispose` permanently disables the current effect instance. Unmount and option changes abort reads, release selections and dispose the client. React StrictMode's effect cleanup/setup receives a new client. Concurrent reads use the configured public client limit; the most recently started read alone can update displayed state, while each promise returns its own ClientResult. A capacity rejection remains a real client result.

Views render received, denied, no-body, rejected and failed responses and the supplied proof limits as text. Disclosed catalog/closure/omission values are bounded display data, not a second protocol parser. Default display limits are 20 items per list and 4096 characters per item; truncation is explicit. Cross-request expansion is unsupported (NOT_PROVEN). No local authorization or action capability is created.

Pass `state={reader}` to distinguish checking a file, waiting for a read, cancellation, release and disposal. This uses the current hook state as one snapshot; it takes precedence over a separately supplied `result`. The existing `result={reader.result}` form remains supported, but cannot distinguish lifecycle phases when the result is absent. An absent response never establishes empty content, first use, maintenance or permission.

`reader.selectionResult` preserves the current public selection result. A rejected selection can include the Core-provided `states`, `diagnostics` and `component_failure`; the view displays these as bounded text without reinterpreting them. A selected file has no implied Read permission. Presentation never starts a read, retries a request, creates an object or changes access.

For a source checkout, run `npm ci --offline --ignore-scripts --omit=optional --no-audit --no-fund`, then `npm run ci`. The checked-in lock resolves the current local vendor archives, including TypeScript 5.9.3. The default suite uses Node Request/Response objects in process; it establishes no real HTTP, browser layout, CORS or remote acknowledgement. The separate historical `test:http` requires its own `KDNA_TEST_ORIGIN` fixture and is not part of this candidate's current observations.

See [consumption contract](docs/consumption-contract.md), [exact dependency binding](public-contract-binding.json) and [security](SECURITY.md). The prior API is removed; there is no compatibility alias or deep import. This candidate is not a public release authorization.
