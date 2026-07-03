# useKDNALoadPlan

Manage the load-plan state machine for a file that has already been
uploaded via `uploadKDNA` or `<KDNAFileDropzone>`.

---

## Usage

```js
import { useKDNALoadPlan } from '@aikdna/kdna-react'

function AssetLoader({ fileId }) {
  const { status, missing, refresh, plan, error } = useKDNALoadPlan({
    fileId,
    endpoint: '/api/kdna',
  })

  if (status === 'locked') return <p>Missing: {missing.join(', ')}</p>
  return <p>Status: {status}</p>
}
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options.fileId` | `string` | required | File ID from `uploadKDNA` or `<KDNAFileDropzone>` |
| `options.endpoint` | `string` | required | Base URL of the KDNA server adapter |
| `options.context` | `object` | `{}` | LoadPlan input context |
| `options.enabled` | `boolean` | `true` | Set to `false` to skip checking |

---

## Return value

| Field | Type | Description |
|-------|------|-------------|
| `status` | `GateStatus` | Current state |
| `missing` | `string[]` | What the asset requires before loading |
| `plan` | `object \| null` | Full LoadPlan from `/plan-load` |
| `refresh` | `() => Promise<object \| null>` | Re-run `/plan-load` |
| `error` | `Error \| null` | Set when `status === 'error'` |

### GateStatus

`'idle' | 'checking' | 'ready' | 'locked' | 'error'`
