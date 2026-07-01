# useKDNA

Fetch and load a `.kdna` asset from a URL. Returns the formatted
content and the current loading status.

---

## Usage

```js
import { useKDNA } from '@aikdna/kdna-react'

function MyComponent({ assetUrl }) {
  const { content, status, error } = useKDNA(assetUrl, {
    endpoint: '/api/kdna',
    profile: 'compact',
  })

  if (status === 'loading') return <p>Loading…</p>
  if (error)                return <p>Error: {error.message}</p>
  return <pre>{content}</pre>
}
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | required | URL of the `.kdna` file to fetch and load |
| `options.endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `options.profile` | `string` | `'compact'` | Load profile |
| `options.enabled` | `boolean` | `true` | Set to `false` to skip the fetch |

---

## Return value

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string \| null` | Loaded content (when `status === 'loaded'`) |
| `status` | `HookStatus` | Current state |
| `error` | `Error \| null` | Set when `status === 'error'` |
| `reload` | `() => void` | Re-fetch and re-load |

### HookStatus

`'idle' | 'fetching' | 'uploading' | 'checking' | 'loading' | 'loaded' | 'error'`

---

## Notes

- This hook is intended for open (unencrypted) assets and for assets
  that can be loaded without user-provided credentials.
- For password-protected or licensed assets, use
  [`useKDNALoadPlan`](./useKDNALoadPlan.md) and supply credentials
  through the `load()` function.
- The `url` is fetched by the server (via `/inspect` with a URL
  parameter), not by the browser. This avoids CORS issues with
  externally hosted `.kdna` files.
