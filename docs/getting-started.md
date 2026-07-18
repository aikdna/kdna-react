# Getting started with @aikdna/kdna-react

---

## Prerequisites

- Node.js 20 or later
- React 18 or 19
- A server running `@aikdna/kdna-web-server@0.3.0` (see
  [its getting-started guide](https://github.com/aikdna/kdna-web-server/blob/main/docs/getting-started.md))

---

## Step 1 — Install

```bash
npm install @aikdna/kdna-react
```

The package installs exact `@aikdna/kdna-web-client@0.2.2` as its browser
network and Runtime Capsule validation boundary.

---

## Step 2 — Display a KDNA asset (read-only, no encryption)

```jsx
import { KDNAFileDropzone, KDNALoadPlanGate } from '@aikdna/kdna-react'

export function AssetViewer() {
  return (
    <KDNAFileDropzone endpoint="/api/kdna">
      {({ fileId, inspect, loading }) => {
        if (loading) return <p>Uploading…</p>
        if (!fileId) return <p>Select a .kdna file to begin.</p>
        return (
          <KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna">
            {({ status, content }) => {
              if (status === 'loaded') {
                return <pre>{JSON.stringify(content, null, 2)}</pre>
              }
              return <p>Status: {status}</p>
            }}
          </KDNALoadPlanGate>
        )
      }}
    </KDNAFileDropzone>
  )
}
```

---

## Step 3 — Handle password-protected assets

```jsx
import {
  KDNAFileDropzone,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
} from '@aikdna/kdna-react'
import { useState } from 'react'

function ProtectedAsset({ fileId }) {
  const [content, setContent] = useState(null)

  if (content) return <pre>{JSON.stringify(content, null, 2)}</pre>

  return (
    <KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna">
      {({ status }) => status === 'locked' ? (
        <KDNAPasswordUnlockDialog
          fileId={fileId}
          endpoint="/api/kdna"
          onUnlock={(result) => setContent(result.content)}
        />
      ) : null}
    </KDNALoadPlanGate>
  )
}

export function ProtectedViewer() {
  return (
    <KDNAFileDropzone endpoint="/api/kdna">
      {({ fileId }) =>
        fileId ? <ProtectedAsset key={fileId} fileId={fileId} /> : null
      }
    </KDNAFileDropzone>
  )
}
```

---

## Step 4 — Load an uploaded KDNA asset with a hook

```jsx
import { useKDNA } from '@aikdna/kdna-react'

export function UploadedAsset({ fileId }) {
  const { content, status, error, load } = useKDNA({
    fileId,
    endpoint: '/api/kdna',
    profile: 'compact',
  })

  if (status === 'checking') return <p>Checking...</p>
  if (error) return <p>Error: {error.message}</p>
  if (status === 'ready') {
    return <button onClick={() => void load().catch(() => {})}>Load</button>
  }
  return <pre>{JSON.stringify(content, null, 2)}</pre>
}
```

---

## Next steps

- [Component reference](../README.md#components)
- [Hooks reference](../README.md#hooks)
- [Styling guide](../README.md#styling)
- [Full end-to-end scaffold](https://github.com/aikdna/create-kdna-web-app)
