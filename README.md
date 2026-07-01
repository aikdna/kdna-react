# @aikdna/kdna-react

**React components and hooks for KDNA-integrated web applications.**

Drop in `<KDNAFileDropzone>` to let users select a `.kdna` file.
Use `<KDNALoadPlanGate>` to render content only when the asset is
loaded. Wrap `<KDNAPasswordUnlockDialog>` around any encrypted asset.
Let `<KDNACreatorWizard>` guide users through building a new asset.

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
npm install @aikdna/kdna-react @aikdna/kdna-web-client
```

React 18 or later is required as a peer dependency.

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
| `children` | `render prop` | required | Receives `{ file, fileId, inspect, loading }` |

→ [Full reference](./docs/components/KDNAFileDropzone.md)

---

### `<KDNALoadPlanGate>`

Evaluates the LoadPlan and manages the full state machine:
`idle → checking → ready | locked | error → loading → loaded`.

```jsx
<KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna" profile="compact">
  {({ status, content, missing, load }) => { /* ... */ }}
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
| `onUnlock` | `(result) => void` | required | Called on successful load |
| `onCancel` | `() => void` | required | Called when dialog is dismissed |

→ [Full reference](./docs/components/KDNAPasswordUnlockDialog.md)

---

### `<KDNALicenseActivationForm>`

Accepts a license key, calls `/activate`, and provides the signed
entitlement token on success.

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

### `<KDNACreatorWizard>`

A multi-step wizard for creating a new `.kdna` asset through a
web interface. Calls `/export` when the user completes the wizard
and triggers a file download.

```jsx
<KDNACreatorWizard
  endpoint="/api/kdna"
  onExported={(filename) => console.log('Created:', filename)}
/>
```

→ [Full reference](./docs/components/KDNACreatorWizard.md)

---

### `<KDNAExportButton>`

A button that calls `/export` for a previously uploaded Studio
project and triggers a browser download of the resulting `.kdna` file.

```jsx
<KDNAExportButton
  projectFileId={projectFileId}
  endpoint="/api/kdna"
  encryptionMode="password"
  password={password}
>
  Export .kdna
</KDNAExportButton>
```

→ [Full reference](./docs/components/KDNAExportButton.md)

---

## Hooks

### `useKDNA(url, options?)`

Fetch and load a `.kdna` asset by URL. Returns the load result
and a status value.

```js
const { content, status, error } = useKDNA('/assets/my.kdna', {
  profile: 'compact',
  endpoint: '/api/kdna',
})
```

→ [Full reference](./docs/hooks/useKDNA.md)

---

### `useKDNALoadPlan(fileId, options?)`

Manage the load-plan state machine for a file that has already
been uploaded.

```js
const { status, missing, load, content } = useKDNALoadPlan(fileId, {
  endpoint: '/api/kdna',
  profile: 'compact',
})
```

→ [Full reference](./docs/hooks/useKDNALoadPlan.md)

---

## Styling

Components ship with minimal structural CSS only. Override the
default appearance using CSS custom properties:

```css
:root {
  --kdna-accent:         #6366f1;
  --kdna-radius:         8px;
  --kdna-dropzone-bg:    #f8f9fa;
  --kdna-dropzone-border:#d1d5db;
  --kdna-font:           inherit;
}
```

All component class names are prefixed with `kdna-` and are stable
across minor versions.

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
