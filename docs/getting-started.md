# Getting started with @aikdna/kdna-react

---

## Prerequisites

- React 18 or later
- A server running `@aikdna/kdna-web-server` (see
  [its getting-started guide](https://github.com/aikdna/kdna-web-server/blob/main/docs/getting-started.md))

---

## Step 1 — Install

```bash
npm install @aikdna/kdna-react @aikdna/kdna-web-client
```

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
              if (status === 'loaded') return <pre>{content}</pre>
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

export function ProtectedViewer() {
  const [content, setContent] = useState(null)

  return (
    <KDNAFileDropzone endpoint="/api/kdna">
      {({ fileId }) =>
        fileId && (
          <KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna">
            {({ status }) => {
              if (status === 'locked') {
                return (
                  <KDNAPasswordUnlockDialog
                    fileId={fileId}
                    endpoint="/api/kdna"
                    onUnlock={(result) => setContent(result.content)}
                    onCancel={() => {}}
                  />
                )
              }
              if (content) return <pre>{content}</pre>
              return null
            }}
          </KDNALoadPlanGate>
        )
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

  if (status === 'ready') return <button onClick={() => load()}>Load</button>
  if (status === 'checking') return <p>Checking...</p>
  if (error) return <p>Error: {error.message}</p>
  return <pre>{content}</pre>
}
```

---

## Next steps

- [Component reference](../README.md#components)
- [Hooks reference](../README.md#hooks)
- [Styling guide](../README.md#styling)
- [Full end-to-end scaffold](https://github.com/aikdna/create-kdna-web-app)
