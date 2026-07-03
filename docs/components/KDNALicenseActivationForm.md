# KDNALicenseActivationForm

Accepts a license key, calls `/activate` to obtain a signed
entitlement record or token, and calls `onActivated` on success.

The request body uses the activation server's canonical field name:
`{ "domain": "...", "license_key": "..." }`.

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
| `onActivated` | `(entitlement: object \| string) => void` | — | Called with the signed entitlement record or token on success |
| `onError` | `(err: Error) => void` | — | Called when activation fails |
| `label` | `string` | `'License key'` | Input label text |
| `submitLabel` | `string` | `'Activate'` | Submit button text |

---

## What happens after activation

Pass the returned entitlement to `<KDNALoadPlanGate>` via its
`load({ entitlementToken: entitlement })` call, or store it in your
application state for repeated loads.

The entitlement is signed by your activation server. It has an expiry
date (`offline_valid_until`). When it expires, call this component
again to refresh it.
