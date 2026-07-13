# @aikdna/kdna-react

**React components and hooks for KDNA-integrated web applications.**

Drop in `<KDNAFileDropzone>` to let users select a `.kdna` file.
Use `<KDNALoadPlanGate>` to render content only when the asset is
loaded. Wrap `<KDNAPasswordUnlockDialog>` around any encrypted asset.

Everything delegates to `@aikdna/kdna-web-server` for server-side
decryption — the browser never holds a key.

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

React 18 or later is required as a peer dependency. The components call the
KDNA server through the `endpoint` props you provide; pair them with
`@aikdna/kdna-web-server` in your app server or your own compatible API.

---

## Quick start

```jsx
import {
  KDNAFileDropzone,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  KDNAAssetInspector,
} from '@aikdna/kdna-react'

export function KDNAViewer() {
  return (
    <KDNAFileDropzone endpoint="/api/kdna">
      {({ file, fileId, inspect }) => (
        <KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna">
          {({ status, content }) =>
            status === 'locked' ? (
              <KDNAPasswordUnlockDialog fileId={fileId} endpoint="/api/kdna" />
            ) : status === 'loaded' ? (
              <pre>{content}</pre>
            ) : (
              <KDNAAssetInspector inspect={inspect} />
            )
          }
        </KDNALoadPlanGate>
      )}
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
<KDNAFileDropzone
  endpoint="/api/kdna"
  onError={(err) => console.error(err)}
>
  {({ file, fileId, inspect, loading }) => (
    <p>{loading ? 'Uploading…' : inspect?.domain}</p>
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

Accepts a license key, calls `/activate`, and provides the signed
entitlement record or token on success.

```jsx
<KDNALicenseActivationForm
  domain="@author/asset-name"
  endpoint="/api/kdna"
  onActivated={(token) => setEntitlementToken(token)}
/>
```

→ [Full reference](./docs/components/KDNALicenseActivationForm.md)

---

### `<KDNAAssetInspector>`

Read-only display of `.kdna` manifest metadata. Shows domain,
version, title, description, load-plan mode, available profiles,
and encryption status. Accepts the `/inspect` response object.

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

Components are intentionally unstyled in this MVP. Bring your own
CSS, or wrap the render-prop state in your app's design system.

## Consumption traces

Applications that use the KDNA consumption runtime can render a trace alongside
their own UI. The `trace` helpers and `useTrace` hook expose the selected
primary asset, advisors, rejected candidates, budget state, and provenance.
Treat this information as an explanation of an application decision; it does
not certify an asset or expose protected payload content.
The package exports matching TypeScript declarations for the complete public
JavaScript surface and accepts only the current JudgmentTrace contract.

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
