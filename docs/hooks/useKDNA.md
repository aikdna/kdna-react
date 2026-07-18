# useKDNA

Manage load-plan state and explicit `/load` calls for a `.kdna` file
that has already been uploaded to your KDNA web server.

---

## Usage

```js
import { useKDNA } from '@aikdna/kdna-react'

function MyComponent({ fileId }) {
  const { content, status, error, load } = useKDNA({
    fileId,
    endpoint: '/api/kdna',
    profile: 'compact',
  })

  if (status === 'checking') return <p>Checking...</p>
  if (error)                return <p>Error: {error.message}</p>
  if (status === 'ready') {
    return <button onClick={() => void load().catch(() => {})}>Load</button>
  }
  return <pre>{JSON.stringify(content, null, 2)}</pre>
}
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.fileId` | `string` | required | File ID returned by `<KDNAFileDropzone>` or an upload endpoint |
| `options.endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `options.profile` | `string` | `'compact'` | Load profile |

---

## Return value

| Field | Type | Description |
|-------|------|-------------|
| `content` | `object \| null` | Validated Runtime Capsule context |
| `status` | `HookStatus` | Current state |
| `error` | `Error \| null` | Set when `status === 'error'` |
| `load` | `(opts?: LoadOptions) => Promise<object \| null>` | Trigger a `/load` call |
| `loading` | `boolean` | True while `/load` is in flight |

### HookStatus

`'idle' | 'checking' | 'ready' | 'locked' | 'error'`

---

## Notes

- Upload or inspect the asset first; this hook does not fetch a `.kdna`
  URL by itself.
- For password-protected or licensed assets, pass credentials through
  the returned `load()` function.
- Exact Web Client 0.2.2 performs the load request, bounds errors/responses,
  and validates the complete Runtime Capsule before `content` is set.
- When `fileId`, endpoint, or profile changes, a late result from the previous
  request is discarded instead of replacing the new asset state; a saved load
  callback from that older identity becomes a no-op.
