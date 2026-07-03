# KDNAExportButton

A button that POSTs a caller-provided `payload` to `/export` and
passes the JSON response to `onExport`. It does not trigger a browser
download by itself.

---

## Usage

```jsx
import { KDNAExportButton } from '@aikdna/kdna-react'

<KDNAExportButton
  endpoint="/api/kdna"
  payload={{ projectFileId, encryptionMode: 'none' }}
  onExport={(result) => console.log(result)}
>
  Export .kdna
</KDNAExportButton>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `payload` | `object` | `{}` | JSON body sent to `/export` |
| `onExport` | `(result: object) => void` | — | Called with the JSON response |
| `children` | `ReactNode` | `'Export KDNA'` | Button label |
