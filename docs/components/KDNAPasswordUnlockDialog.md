# KDNAPasswordUnlockDialog

A modal dialog that prompts the user for a password and submits it
to `/load`. Calls `onUnlock` with the load result on success.

---

## Usage

```jsx
import { KDNAPasswordUnlockDialog } from '@aikdna/kdna-react'

<KDNAPasswordUnlockDialog
  fileId={fileId}
  endpoint="/api/kdna"
  onUnlock={(result) => setContent(result.content)}
  onCancel={() => setShowDialog(false)}
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fileId` | `string` | required | |
| `endpoint` | `string` | required | |
| `profile` | `string` | `'compact'` | Load profile to request |
| `onUnlock` | `(result: LoadResult) => void` | — | Called on successful load |
| `onCancel` | `() => void` | — | Called when the dialog is dismissed |
| `onError` | `(err: Error) => void` | — | Called when unlock fails |
| `hint` | `string \| null` | — | Password hint from the LoadPlan, displayed below the input |
| `title` | `string` | `'Unlock asset'` | Dialog title |

---

## Security note

The password entered in the dialog input is held in React state only
for the duration between the user typing and the `/load` request
completing. It is not written to `localStorage`, `sessionStorage`,
or any external store. Once the request completes (success or failure),
the input is cleared.
