# KDNAFileDropzone

A drag-and-drop and click-to-browse file input for `.kdna` files.
On selection it calls `/inspect` and exposes the result to children
via a render prop.

---

## Usage

```jsx
import { KDNAFileDropzone } from '@aikdna/kdna-react'

<KDNAFileDropzone endpoint="/api/kdna">
  {({ fileId, inspect, loading, error }) => (
    <div>
      {loading && <p>Uploading…</p>}
      {error && <p role="alert">Upload failed ({error.code || 'KDNA_UPLOAD_FAILED'}).</p>}
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
| `label` | `string` | `'Choose a KDNA file'` | Accessible label for the hidden file input |
| `children` | `(state: DropzoneState) => ReactNode` | required | Render prop |

### DropzoneState

| Field | Type | Description |
|-------|------|-------------|
| `file` | `File \| null` | The selected browser File object |
| `fileId` | `string \| null` | Server-assigned ID — pass to other components |
| `inspect` | `InspectResult \| null` | Bounded public `/inspect` projection |
| `loading` | `boolean` | `true` while uploading and inspecting |
| `error` | `Error \| null` | Set if the upload or inspect call failed |
| `reset` | `() => void` | Clear the current selection |

---

## Accessibility

- The dropzone has `role="button"` and `tabindex="0"`.
- Keyboard users can press `Enter` or `Space` to open the file picker.
- The hidden `<input type="file">` is labelled by an accessible
  `aria-label` derived from the `label` prop.

The component uses exact `@aikdna/kdna-web-client@0.2.2`. Unknown server
fields, internal paths, and upstream error bodies are not exposed to the
render prop. Selecting a new file prevents an older in-flight upload from
replacing the new selection.
