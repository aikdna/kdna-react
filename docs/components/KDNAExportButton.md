# KDNAExportButton

A button that calls `/export` for an already-uploaded Studio project
and triggers a browser download of the compiled `.kdna` file.

> Requires `@aikdna/kdna-studio-core` on the server.

---

## Usage

```jsx
import { KDNAExportButton } from '@aikdna/kdna-react'

<KDNAExportButton
  projectFileId={projectFileId}
  endpoint="/api/kdna"
  encryptionMode="none"
>
  Export .kdna
</KDNAExportButton>
```

Password-encrypted export:

```jsx
<KDNAExportButton
  projectFileId={projectFileId}
  endpoint="/api/kdna"
  encryptionMode="password"
  password={password}
  onExported={(filename) => console.log('Saved:', filename)}
>
  Export with password
</KDNAExportButton>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectFileId` | `string` | required | File ID of an uploaded Studio project `.zip` |
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `encryptionMode` | `'none' \| 'password' \| 'licensed'` | `'none'` | Encryption mode for the exported file |
| `password` | `string` | — | Required when `encryptionMode` is `'password'` |
| `onExported` | `(filename: string) => void` | — | Called after the download is triggered |
| `onError` | `(err: Error) => void` | — | Called when export fails |
| `disabled` | `boolean` | `false` | |
| `children` | `ReactNode` | `'Export'` | Button label |
