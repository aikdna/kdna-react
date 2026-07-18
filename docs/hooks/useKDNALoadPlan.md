# useKDNALoadPlan

Manage the load-plan state machine for a file that has already been
uploaded via `uploadKDNA` or `<KDNAFileDropzone>`.

The hook delegates to exact `@aikdna/kdna-web-client@0.2.2`; unknown server
fields and upstream error bodies do not enter the returned state.

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
| `options.context` | `object` | `{}` | JSON LoadPlan context; raw secrets are rejected |
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

Equivalent JSON objects are treated as one context, so an inline object does
not trigger a request loop. Raw passwords, passphrases, license keys, API
keys, authorization values, cookies, and access/refresh tokens are rejected;
send one-shot credentials through `useKDNA().load(options)` instead. The
documented server-issued `entitlement`/`entitlementToken` context is accepted,
normalized, and held only in hook memory while that context is active. Clear
it from parent state when it is no longer needed and never log the context.

After file, endpoint, or context identity changes, older results and stale
saved `refresh` callbacks become no-ops.
