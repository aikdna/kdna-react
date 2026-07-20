> **Frozen historical repository**
>
> This repository is not part of the current supported KDNA toolchain. It
> receives no feature or compatibility work and will not publish new releases.
> Do not use it for new integrations. Its code remains available as development
> history.

# @aikdna/kdna-react

**React components and hooks for KDNA-integrated web applications.**

Drop in `<KDNAFileDropzone>` to let users select a `.kdna` file.
Use `<KDNALoadPlanGate>` to render content only when the asset is
loaded. Wrap `<KDNAPasswordUnlockDialog>` around any encrypted asset.

Networking, bounded response parsing, public-field projection, and Runtime
Capsule validation come from the exact `@aikdna/kdna-web-client@0.2.2`
runtime dependency. Pair the components with `@aikdna/kdna-web-server@0.3.0`
or a compatible server. Password and license inputs exist briefly in the
browser form state, are cleared before and after each request, and are never
persisted by this package. Decryption remains server-side.

> New to KDNA? → [KDNA Core](https://github.com/aikdna/kdna)
>
> Need browser utilities without React? →
> [@aikdna/kdna-web-client](https://github.com/aikdna/kdna-web-client)
>
> Need the server-side adapter? →
> [@aikdna/kdna-web-server](https://github.com/aikdna/kdna-web-server)

[![npm](https://img.shields.io/npm/v/@aikdna/kdna-react)](https://www.npmjs.com/package/@aikdna/kdna-react)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

---

## Install

```bash
npm install @aikdna/kdna-react
```

Node.js 20 or later is required for SSR, testing, and build tooling. React 18
or 19 is supported as a peer dependency. npm installs the exact Web Client
runtime automatically. The components call the KDNA server through the
`endpoint` props you provide.

---

## Quick start

```jsx
import {
  KDNAFileDropzone,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  KDNAAssetInspector,
} from '@aikdna/kdna-react'
import { useState } from 'react'

function UploadedKDNAViewer({ fileId, inspect }) {
  const [unlockedContent, setUnlockedContent] = useState(null)

  if (unlockedContent) {
    return <pre>{JSON.stringify(unlockedContent, null, 2)}</pre>
  }

  return (
    <KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna">
      {({ status, content }) =>
        status === 'locked' ? (
          <KDNAPasswordUnlockDialog
            fileId={fileId}
            endpoint="/api/kdna"
            onUnlock={(result) => setUnlockedContent(result.content)}
          />
        ) : status === 'loaded' ? (
          <pre>{JSON.stringify(content, null, 2)}</pre>
        ) : (
          <KDNAAssetInspector inspect={inspect} />
        )
      }
    </KDNALoadPlanGate>
  )
}

export function KDNAViewer() {
  return (
    <KDNAFileDropzone endpoint="/api/kdna">
      {({ fileId, inspect }) => fileId
        ? <UploadedKDNAViewer key={fileId} fileId={fileId} inspect={inspect} />
        : <p>Select a .kdna file to begin.</p>}
    </KDNAFileDropzone>
  )
}
```

---

## Components

### `<KDNAFileDropzone>`

A drag-and-drop and click-to-browse file selector for `.kdna` files.
Calls `/api/kdna/inspect` on selection and provides the result to
children via render props.

```jsx
<KDNAFileDropzone endpoint="/api/kdna">
  {({ inspect, loading, error }) => (
    <p>{error ? `Upload failed (${error.code || 'KDNA_UPLOAD_FAILED'}).`
      : loading ? 'Uploading…' : inspect?.domain}</p>
  )}
</KDNAFileDropzone>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `onError` | `(err: Error) => void` | — | Called when upload or inspect fails |
| `maxSizeBytes` | `number` | `10485760` | Reject files larger than this |
| `disabled` | `boolean` | `false` | Disable browse and drop interactions |
| `className` | `string` | — | Added to the root element |
| `label` | `string` | `'Choose a KDNA file'` | Accessible label for the hidden file input |
| `children` | `render prop` | required | Receives `{ file, fileId, inspect, loading, error, reset }` |

→ [Full reference](./docs/components/KDNAFileDropzone.md)

---

### `<KDNALoadPlanGate>`

Evaluates the LoadPlan and manages the full state machine:
`idle → checking → ready | locked | error`, then auto-loads ready
assets and exposes loaded content when available.

```jsx
<KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna" profile="compact">
  {({ status, content, missing, loading, load }) => { /* ... */ }}
</KDNALoadPlanGate>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fileId` | `string` | required | File ID from `<KDNAFileDropzone>` or `uploadKDNA` |
| `endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `profile` | `string` | `'compact'` | Load profile to request |
| `children` | `render prop` | required | Receives state object |

→ [Full reference](./docs/components/KDNALoadPlanGate.md)

---

### `<KDNAPasswordUnlockDialog>`

A modal dialog that prompts the user for a password, submits it
to `/load`, and calls `onUnlock` with the result.

```jsx
<KDNAPasswordUnlockDialog
  fileId={fileId}
  endpoint="/api/kdna"
  onUnlock={(result) => setContent(result.content)}
  onCancel={() => setShowDialog(false)}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fileId` | `string` | required | |
| `endpoint` | `string` | required | |
| `profile` | `string` | `'compact'` | |
| `onUnlock` | `(result) => void` | — | Called on successful load |
| `onCancel` | `() => void` | — | Called when dialog is dismissed |
| `onError` | `(err: Error) => void` | — | Called when unlock fails |
| `hint` | `string \| null` | — | Password hint text |
| `title` | `string` | `'Unlock asset'` | Dialog title |

→ [Full reference](./docs/components/KDNAPasswordUnlockDialog.md)

---

### `<KDNALicenseActivationForm>`

Accepts a license key, calls `/activate`, and provides a structurally bounded
entitlement record containing the server-provided signature on success. The
input is password-masked and cleared before and after the request. The browser
checks response shape, active state, lease, expiry, and binding. The optional
`client` is a caller-declared label, not authorization authority; allowlist
enforcement and signature verification remain authoritative server/runtime
responsibility.

```jsx
<KDNALicenseActivationForm
  domain="kdna:creator:asset"
  endpoint="/api/kdna"
  machineFingerprint={sha256DeviceFingerprint}
  client="my-kdna-app"
  onActivated={(entitlement) => setEntitlement(entitlement)}
/>
```

Supply `machineFingerprint` only when your application has an issuer-approved,
canonical 64-character lowercase SHA-256 device fingerprint. The component
does not invent hardware identity. Omit it for an unbound license.

→ [Full reference](./docs/components/KDNALicenseActivationForm.md)

---

### `<KDNAAssetInspector>`

Read-only display of the bounded public `/inspect` projection. Shows domain,
version, title, description, current LoadPlan state/action, default and
available profiles, and encryption status.

```jsx
<KDNAAssetInspector inspect={inspect} />
```

→ [Full reference](./docs/components/KDNAAssetInspector.md)

---

## Hooks

### `useKDNA(options?)`

Manage load-plan state and explicit `/load` calls for a file that
has already been uploaded to the server.

```js
const { content, status, error, load } = useKDNA({
  fileId,
  profile: 'compact',
  endpoint: '/api/kdna',
})

if (status === 'ready') await load()
```

→ [Full reference](./docs/hooks/useKDNA.md)

---

### `useKDNALoadPlan(options?)`

Manage the load-plan state machine for a file that has already
been uploaded.

```js
const { status, missing, refresh, plan } = useKDNALoadPlan({
  fileId,
  endpoint: '/api/kdna',
})
```

→ [Full reference](./docs/hooks/useKDNALoadPlan.md)

---

## Styling

Components are intentionally unstyled. Bring your own
CSS, or wrap the render-prop state in your app's design system.

## Consumption traces

Applications that use the KDNA consumption runtime can render a trace alongside
their own UI. Every public trace helper, viewer, and `useTrace` projection
validates the complete JudgmentTrace schema closure pinned to an audited KDNA
Core commit and fails closed on unknown or inconsistent nested evidence. They
keep Capsule delivery, Host execution, semantic consumption, and conformance
as separate evidence layers. A correlated response proves delivery and
execution; it does not prove that a model semantically consumed the judgment
or that the result conforms to it.

The viewer exposes the primary asset identity, budget comparison, result
digest, and provenance without rendering free-form warning or error messages;
it shows only warning counts and bounded issue codes/phases. `useTrace` returns
the validated trace evidence to application code, which must still treat
producer-supplied strings as untrusted and avoid logging them. Browser
validation proves schema conformance only; authoritative cryptographic and
semantic conformance checks remain server-side KDNA Core responsibilities.
The package exports matching TypeScript declarations for the complete public
JavaScript surface.

---

## Related packages

| Package | Role |
|---------|------|
| [`@aikdna/kdna-core`](https://github.com/aikdna/kdna) | KDNA format and runtime |
| [`@aikdna/kdna-web-server`](https://github.com/aikdna/kdna-web-server) | Server-side adapter |
| [`@aikdna/kdna-web-client`](https://github.com/aikdna/kdna-web-client) | Browser utilities (no React) |
| [`create-kdna-web-app`](https://github.com/aikdna/create-kdna-web-app) | Project scaffolding CLI |

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
