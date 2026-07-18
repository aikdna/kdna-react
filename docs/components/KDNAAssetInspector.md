# KDNAAssetInspector

Read-only display of a `.kdna` asset's public manifest fields.
Accepts the response object from `/inspect`.

---

## Usage

```jsx
import { KDNAAssetInspector } from '@aikdna/kdna-react'

// inspect is the response from /api/kdna/inspect
<KDNAAssetInspector inspect={inspect} />
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `inspect` | `InspectResult` | required | The `/inspect` response object |
| `showProfiles` | `boolean` | `true` | Show the available load profiles |
| `showLoadPlan` | `boolean` | `true` | Show the current LoadPlan state and required action |
| `className` | `string` | — | Added to the root element |

---

## InspectResult shape

```ts
{
  domain:      string
  version:     string
  title:       string | null
  description: string | null
  encrypted:   boolean
  defaultProfile: string | null
  profiles?:   string[]
  loadPlan: {
    state:           string
    required_action: string
    can_load_now:    boolean
  }
}
```

---

## Rendered fields

| Field | Always shown |
|-------|-------------|
| Domain | Yes |
| Version | Yes |
| Title | When present |
| Description | When present |
| Encryption status | Yes |
| LoadPlan state/action | When `showLoadPlan` is true |
| Default profile | When present and `showProfiles` is true |
| Available profiles | When `showProfiles` is true |

This component does not display any payload content — only manifest
metadata that is safe to show before authentication.
