# KDNAFileDropzone

A drag-and-drop and click-to-browse file input for `.kdna` files.
On selection it calls `/inspect` and exposes the result to children
via a render prop.

---

## Usage

```jsx
import { KDNAFileDropzone } from '@aikdna/kdna-react'

<KDNAFileDropzone endpoint="/api/kdna" onError={console.error}>
  {({ file, fileId, inspect, loading }) => (
    <div>
      {loading && <p>Uploading…</p>}
      {inspect && <p>{inspect.domain} v{inspect.version}</p>}
    </div>
  )}
</KDNAFileDropzone>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | required | Base URL for KDNA API calls |
| `onError` | `(err: Error) => void` | — | Called when upload or inspect fails |
| `maxSizeBytes` | `number` | `10485760` (10 MB) | Files larger than this are rejected before upload |
| `disabled` | `boolean` | `false` | Disable the dropzone |
| `className` | `string` | — | Added to the root element |
| `children` | `(state: DropzoneState) => ReactNode` | required | Render prop |

### DropzoneState

| Field | Type | Description |
|-------|------|-------------|
| `file` | `File \| null` | The selected browser File object |
| `fileId` | `string \| null` | Server-assigned ID — pass to other components |
| `inspect` | `InspectResult \| null` | Full `/inspect` response |
| `loading` | `boolean` | `true` while uploading and inspecting |
| `error` | `Error \| null` | Set if the upload or inspect call failed |
| `reset` | `() => void` | Clear the current selection |

---

## CSS custom properties

| Property | Default | Description |
|----------|---------|-------------|
| `--kdna-dropzone-bg` | `#f8f9fa` | Background color |
| `--kdna-dropzone-border` | `#d1d5db` | Border color (dashed) |
| `--kdna-dropzone-active-border` | `--kdna-accent` | Border when a file is dragged over |
| `--kdna-dropzone-radius` | `--kdna-radius` | Corner radius |

---

## Accessibility

- The dropzone has `role="button"` and `tabindex="0"`.
- Keyboard users can press `Enter` or `Space` to open the file picker.
- The hidden `<input type="file">` is labelled by an accessible
  `aria-label` derived from the `label` prop.
