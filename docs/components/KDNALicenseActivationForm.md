# KDNALicenseActivationForm

Accepts a license key, calls `/activate` to obtain a structurally bounded
entitlement record containing the server-provided signature, and calls
`onActivated` on success.

The request body uses the activation server's canonical field name:
`{ "domain": "...", "license_key": "...", "machine_fingerprint": "..." }`.
The machine field is omitted for an unbound license.

---

## Usage

```jsx
import { KDNALicenseActivationForm } from '@aikdna/kdna-react'

<KDNALicenseActivationForm
  domain="kdna:creator:asset"
  endpoint="/api/kdna"
  machineFingerprint={sha256DeviceFingerprint}
  client="my-kdna-app"
  onActivated={(entitlement) => setEntitlement(entitlement)}
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `domain` | `string` | required | Canonical KDNA asset ID (e.g. `kdna:creator:asset`) |
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `machineFingerprint` | `string` | — | Issuer-approved 64-character lowercase SHA-256 device fingerprint for a bound license |
| `client` | `string` | — | Optional caller identifier (1–128 characters) |
| `onActivated` | `(entitlement: object) => void` | — | Called with the bounded entitlement projection |
| `onError` | `(err: Error) => void` | — | Called when activation fails |
| `label` | `string` | `'License key'` | Input label text |
| `submitLabel` | `string` | `'Activate'` | Submit button text |

---

## Binding and secret handling

The application owns device identity. This component does not derive or invent
a machine fingerprint. Supply the canonical fingerprint for a bound license;
omit it for an unbound license. The server validates the asset ID and binding.

The license input uses `type="password"`, exists briefly in React state, and is
cleared immediately when submitted and when the request settles. It is never
stored by this package. Successful responses are allowlisted and every exposed
field is type- and size-checked. Expired, revoked, stale-online-lease, and
binding-mismatched responses fail closed. `client` is only a caller-declared
label, not authorization authority. The browser checks the signature field's
wire shape but does not verify its cryptographic authenticity; authorization
and verification remain server/runtime work. Upstream
response bodies and submitted keys are never attached to errors.
