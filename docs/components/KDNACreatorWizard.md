# KDNACreatorWizard

A multi-step wizard that guides the user through creating a new
`.kdna` asset. Calls `/export` when the wizard completes and
triggers a browser file download.

> Requires `@aikdna/kdna-studio-core` to be installed on the server.
> The `/export` endpoint must be enabled in your `@aikdna/kdna-web-server`
> configuration.

---

## Usage

```jsx
import { KDNACreatorWizard } from '@aikdna/kdna-react'

<KDNACreatorWizard
  endpoint="/api/kdna"
  onExported={(filename) => console.log('Downloaded:', filename)}
  onCancel={() => setShowWizard(false)}
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `onExported` | `(filename: string) => void` | required | Called after the file is downloaded |
| `onCancel` | `() => void` | required | Called when the wizard is dismissed |
| `defaultEncryptionMode` | `'none' \| 'password' \| 'licensed'` | `'none'` | Pre-select encryption mode |

---

## Wizard steps

1. **Domain** — set the asset domain (`@author/asset-name`)
2. **Metadata** — title, description, version
3. **Content** — paste or upload the judgment payload
4. **Encryption** — choose `none`, `password`, or `licensed`
   - `password`: enter and confirm a password
   - `licensed`: point to your activation server URL
5. **Review** — summary of all settings before export
6. **Export** — calls `/export`, downloads the resulting `.kdna` file

---

## Password handling

When the user chooses `password` encryption, the password is held
in wizard state only until the `/export` request completes. It is
not stored anywhere after that.
