# useKDNALoadPlan

Manage the load-plan state machine for a file that has already been
uploaded via `uploadKDNA` or `<KDNAFileDropzone>`.

---

## Usage

```js
import { useKDNALoadPlan } from '@aikdna/kdna-react'

function AssetLoader({ fileId }) {
  const { status, missing, load, content, error } = useKDNALoadPlan(fileId, {
    endpoint: '/api/kdna',
    profile: 'compact',
  })

  if (status === 'locked') {
    const password = prompt('Password:')
    load({ password })
  }

  if (status === 'loaded') return <pre>{content}</pre>
  return <p>Status: {status}</p>
}
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fileId` | `string` | required | File ID from `uploadKDNA` or `<KDNAFileDropzone>` |
| `options.endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `options.profile` | `string` | `'compact'` | Load profile |
| `options.autoLoad` | `boolean` | `false` | Call `load()` automatically when no credentials are required |

---

## Return value

| Field | Type | Description |
|-------|------|-------------|
| `status` | `GateStatus` | Current state |
| `content` | `string \| null` | Loaded content (when `status === 'loaded'`) |
| `missing` | `string[]` | What the asset requires before loading |
| `requirements` | `object` | Full requirements from `/plan-load` |
| `load` | `(opts?: LoadOptions) => void` | Trigger a `/load` call |
| `error` | `Error \| null` | Set when `status === 'error'` |

### GateStatus

`'idle' | 'checking' | 'ready' | 'locked' | 'requires-license' | 'loading' | 'loaded' | 'error'`

### LoadOptions

| Field | Type |
|-------|------|
| `password` | `string` |
| `licenseKey` | `string` |
| `entitlementToken` | `string` |
