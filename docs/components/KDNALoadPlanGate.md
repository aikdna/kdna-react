# KDNALoadPlanGate

Evaluates the LoadPlan for an uploaded file and drives the full
load flow. When the plan is ready, the component calls `/load`
automatically and exposes in-flight work through the `loading` field:

```
idle → checking → ready | locked | error
                    │
                 auto load
                    │
                 loaded | error
```

---

## Usage

```jsx
import { KDNALoadPlanGate } from '@aikdna/kdna-react'

<KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna" profile="compact">
  {({ status, content, missing, loading, error }) => {
    if (status === 'checking') return <p>Checking requirements…</p>
    if (loading)               return <p>Loading…</p>
    if (status === 'locked')   return <p>Password required</p>
    if (status === 'loaded') {
      return <pre>{JSON.stringify(content, null, 2)}</pre>
    }
    if (status === 'error')    return <p>Error: {error?.message}</p>
    return null
  }}
</KDNALoadPlanGate>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fileId` | `string` | required | File ID from `<KDNAFileDropzone>` or `uploadKDNA` |
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `profile` | `string` | `'compact'` | Load profile to request |
| `children` | `(state: GateState) => ReactNode` | required | Render prop |

### GateState

| Field | Type | Description |
|-------|------|-------------|
| `status` | `GateStatus` | Current state |
| `content` | `object \| null` | Validated Runtime Capsule context (only when `status === 'loaded'`) |
| `missing` | `string[]` | Required LoadPlan action(s), such as `'enter_password'` or `'install_receipt'` |
| `plan` | `object \| null` | Full LoadPlan from `/plan-load` |
| `loading` | `boolean` | True while `/load` is in flight |
| `load` | `(opts?: LoadOptions) => Promise<object \| null>` | Trigger a manual load call |
| `error` | `Error \| null` | Set when `status === 'error'` |

The gate uses exact Web Client 0.2.2 and accepts content only from a complete,
validated Runtime Capsule. It auto-loads a ready plan once and stops after an
error; call `load()` explicitly to retry. A result for an older `fileId` cannot
replace state after the selected file changes.

### GateStatus

`'idle' | 'checking' | 'ready' | 'locked' | 'loaded' | 'error'`

### LoadOptions

| Field | Type | Description |
|-------|------|-------------|
| `password` | `string` | For password-protected assets |
| `entitlementToken` | `object \| string` | Server-issued entitlement record or token; authoritative verification remains server-side |
