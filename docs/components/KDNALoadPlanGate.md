# KDNALoadPlanGate

Evaluates the LoadPlan for an uploaded file and drives the full
load-state machine:

```
idle → checking → ready | locked | requires-license | error
                            │
                        load()
                            │
                       loading → loaded | error
```

---

## Usage

```jsx
import { KDNALoadPlanGate } from '@aikdna/kdna-react'

<KDNALoadPlanGate fileId={fileId} endpoint="/api/kdna" profile="compact">
  {({ status, content, missing, load, error }) => {
    if (status === 'checking') return <p>Checking requirements…</p>
    if (status === 'ready')    return <button onClick={() => load()}>Load</button>
    if (status === 'locked')   return <p>Password required</p>
    if (status === 'loaded')   return <pre>{content}</pre>
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
| `autoLoad` | `boolean` | `false` | Automatically call `/load` when `canProceed` is true and no credentials are needed |
| `children` | `(state: GateState) => ReactNode` | required | Render prop |

### GateState

| Field | Type | Description |
|-------|------|-------------|
| `status` | `GateStatus` | Current state |
| `content` | `string \| null` | Loaded content (only when `status === 'loaded'`) |
| `missing` | `string[]` | What is missing (`'password'`, `'licenseKey'`, etc.) |
| `requirements` | `object` | Full requirements object from `/plan-load` |
| `load` | `(opts?: LoadOptions) => void` | Trigger a load call |
| `error` | `Error \| null` | Set when `status === 'error'` |

### GateStatus

`'idle' | 'checking' | 'ready' | 'locked' | 'requires-license' | 'loading' | 'loaded' | 'error'`

### LoadOptions

| Field | Type | Description |
|-------|------|-------------|
| `password` | `string` | For password-protected assets |
| `licenseKey` | `string` | For licensed assets |
| `entitlementToken` | `string` | Pre-fetched entitlement token |
