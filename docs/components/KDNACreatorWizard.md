# KDNACreatorWizard MVP

MVP placeholder container for future browser authoring flows. It
renders children inside a stable KDNA-marked wrapper and does not yet
implement multi-step authoring, `/export`, or browser downloads.

---

## Usage

```jsx
import { KDNACreatorWizard } from '@aikdna/kdna-react'

<KDNACreatorWizard>
  <p>Custom authoring UI goes here.</p>
</KDNACreatorWizard>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | `null` | Custom authoring UI to render inside the wrapper |
