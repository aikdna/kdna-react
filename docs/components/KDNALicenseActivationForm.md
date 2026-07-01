# KDNALicenseActivationForm

Accepts a license key, calls `/activate` to obtain a signed
entitlement token, and calls `onActivated` on success.

---

## Usage

```jsx
import { KDNALicenseActivationForm } from '@aikdna/kdna-react'

<KDNALicenseActivationForm
  domain="@author/asset-name"
  endpoint="/api/kdna"
  onActivated={(token) => setEntitlementToken(token)}
  onError={(err) => console.error(err)}
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `domain` | `string` | required | Asset domain (e.g. `@author/asset-name`) — passed to `/activate` |
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `onActivated` | `(token: string) => void` | required | Called with the signed entitlement token on success |
| `onError` | `(err: Error) => void` | — | Called when activation fails |
| `label` | `string` | `'License key'` | Input label text |
| `submitLabel` | `string` | `'Activate'` | Submit button text |

---

## What happens after activation

Pass the returned `token` to `<KDNALoadPlanGate>` via its
`load({ entitlementToken: token })` call, or store it in your
application state for repeated loads.

The token is a signed record from your activation server. It has an
expiry date (`offline_valid_until`). When it expires, call this
component again to refresh it.
