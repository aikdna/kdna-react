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
| `showLoadPlan` | `boolean` | `true` | Show the load-plan mode and requirements |
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
  profiles:    string[]
  loadPlan: {
    mode:         string   // 'open' | 'password' | 'licensed' | 'remote'
    requirements: string[]
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
| Load-plan mode | When `showLoadPlan` is true |
| Available profiles | When `showProfiles` is true |

This component does not display any payload content — only manifest
metadata that is safe to show before authentication.
